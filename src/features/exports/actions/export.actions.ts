'use server';

import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from 'pdf-lib';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
import { PortfolioGeneration, PortfolioFeedback } from '@/lib/db/portfolio.model';
import { UserProfile } from '@/lib/db/user-profile.model';
import { Types } from 'mongoose';
import { requireSessionUser } from '@/lib/auth-session';
import { withTelemetry } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────

const exportPdfSchema = z.object({
  generationId: z.string().min(1),
});

// ─────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────

export async function exportPortfolioPdf(input: unknown) {
  return withTelemetry('vault.exportPortfolioPdf', {}, async () => {
    const user = await requireSessionUser();
    const { generationId } = exportPdfSchema.parse(input);
    const userId = user.id;

    await connectToDatabase();

    if (!Types.ObjectId.isValid(generationId)) {
      throw new Error('Invalid generationId');
    }

    const generation = await PortfolioGeneration.findOne({
      _id: generationId,
      userId,
    }).lean();

    if (!generation) {
      throw new Error('Generation not found');
    }

    const content = generation.content as {
      summary?: string;
      sections?: Array<{ title?: string; bullets?: string[] }>;
      resumeBullets?: string[];
      keywords?: string[];
    };

    // Load personal profile (may be null if user hasn't filled it in yet)
    const profileDoc = await UserProfile.findOne({ userId }).lean();
    const profile = {
      name:      (profileDoc?.name      as string | undefined) ?? '',
      title:     (profileDoc?.title     as string | undefined) ?? '',
      email:     (profileDoc?.email     as string | undefined) ?? '',
      phone:     (profileDoc?.phone     as string | undefined) ?? '',
      location:  (profileDoc?.location  as string | undefined) ?? '',
      linkedin:  (profileDoc?.linkedin  as string | undefined) ?? '',
      portfolio: (profileDoc?.portfolio as string | undefined) ?? '',
      summary:   (profileDoc?.summary   as string | undefined) ?? '',
      education: (profileDoc?.education as Array<{ degree: string; institution: string; year: string }> | undefined) ?? [],
    };

    // ── Layout constants (A4 in points) ──────────────────────────────────
    const PAGE_W = 595;
    const PAGE_H = 842;
    const ML = 52;
    const MR = 52;
    const MT = 54;
    const MB = 48;
    const CW = PAGE_W - ML - MR;

    // ── Colors ───────────────────────────────────────────────────────────
    const cDark   = rgb(0.11, 0.09, 0.09);
    const cMid    = rgb(0.47, 0.44, 0.42);
    const cAccent = rgb(0.40, 0.22, 0.06);
    const cRule   = rgb(0.87, 0.85, 0.84);

    // ── Font setup ───────────────────────────────────────────────────────
    const pdf  = await PDFDocument.create();
    const fReg = await pdf.embedFont(StandardFonts.Helvetica);
    const fBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page    = pdf.addPage([PAGE_W, PAGE_H]);
    let cursorY = PAGE_H - MT;

    const S = {
      name: 22,
      title: 12,
      meta: 9.25,
      section: 10,
      subhead: 11,
      body: 10,
      small: 8,
    };

    // ── Helpers ──────────────────────────────────────────────────────────

    function wrapText(text: string, font: typeof fReg, size: number, maxWidth: number): string[] {
      const words = text.replace(/\s+/g, ' ').trim().split(' ');
      const out: string[] = [];
      let cur = '';
      for (const word of words) {
        const trial = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
          out.push(cur);
          cur = word;
        } else {
          cur = trial;
        }
      }
      if (cur) out.push(cur);
      return out.length > 0 ? out : [''];
    }

    function ensureRoom(needed: number) {
      if (cursorY - needed < MB) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        cursorY = PAGE_H - MT;
      }
    }

    function drawBlock(
      text: string,
      font: typeof fReg,
      size: number,
      color: ReturnType<typeof rgb>,
      x: number,
      maxWidth: number,
      lineGap = 4
    ) {
      const lines = wrapText(text, font, size, maxWidth);
      for (const line of lines) {
        ensureRoom(size + lineGap);
        page.drawText(line, { x, y: cursorY, size, font, color });
        cursorY -= size + lineGap;
      }
    }

    function fitText(text: string, font: typeof fReg, size: number, maxWidth: number) {
      const input = text.replace(/\s+/g, ' ').trim();
      if (!input) return '';
      if (font.widthOfTextAtSize(input, size) <= maxWidth) return input;
      const ellipsis = '…';
      let out = input;
      while (out.length > 1 && font.widthOfTextAtSize(`${out}${ellipsis}`, size) > maxWidth) {
        out = out.slice(0, -1);
      }
      return `${out}${ellipsis}`;
    }

    function drawCenteredLine(
      text: string,
      opts: { font: typeof fReg; size: number; color: ReturnType<typeof rgb>; maxWidth: number; gapBelow: number }
    ) {
      const t = fitText(text, opts.font, opts.size, opts.maxWidth);
      if (!t) return;
      ensureRoom(opts.size + opts.gapBelow + 2);
      const width = opts.font.widthOfTextAtSize(t, opts.size);
      const x = Math.max(ML, ML + (CW - width) / 2);
      page.drawText(t, { x, y: cursorY, size: opts.size, font: opts.font, color: opts.color });
      cursorY -= opts.size + opts.gapBelow;
    }

    function formatContactValue(value: string) {
      return value
        .trim()
        .replace(/^mailto:/i, '')
        .replace(/^tel:/i, '')
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '');
    }

    function drawRule(thickness = 0.6, color = cRule) {
      page.drawLine({
        start: { x: ML, y: cursorY },
        end:   { x: PAGE_W - MR, y: cursorY },
        thickness,
        color,
      });
    }

    function drawSectionHeader(label: string) {
      ensureRoom(34);
      cursorY -= 12;
      page.drawText(label.toUpperCase(), {
        x: ML, y: cursorY,
        size: S.section, font: fBold, color: cDark,
      });
      cursorY -= 8;
      drawRule(0.6, cRule);
      cursorY -= 10;
    }

    function drawLeftRightLine(opts: {
      left: string;
      right?: string;
      sizeLeft?: number;
      sizeRight?: number;
      fontLeft?: typeof fReg;
      fontRight?: typeof fReg;
      colorLeft?: ReturnType<typeof rgb>;
      colorRight?: ReturnType<typeof rgb>;
      gapBelow?: number;
    }) {
      const {
        left,
        right,
        sizeLeft = S.subhead,
        sizeRight = S.meta,
        fontLeft = fBold,
        fontRight = fReg,
        colorLeft = cDark,
        colorRight = cMid,
        gapBelow = 6,
      } = opts;

      const l = left.trim();
      const r = (right ?? '').trim();
      if (!l && !r) return;

      ensureRoom(sizeLeft + gapBelow + 2);

      const rightW = r ? fontRight.widthOfTextAtSize(r, sizeRight) : 0;
      const leftMax = Math.max(0, CW - (r ? rightW + 10 : 0));
      const leftLine = wrapText(l, fontLeft, sizeLeft, leftMax)[0] ?? '';

      page.drawText(leftLine, { x: ML, y: cursorY, size: sizeLeft, font: fontLeft, color: colorLeft });
      if (r) {
        page.drawText(r, {
          x: PAGE_W - MR - rightW,
          y: cursorY,
          size: sizeRight,
          font: fontRight,
          color: colorRight,
        });
      }
      cursorY -= sizeLeft + gapBelow;
    }

    function drawBullet(text: string) {
      const bulletIndent = 14;
      const textX = ML + bulletIndent;
      const lines = wrapText(text, fReg, S.body, CW - bulletIndent);
      ensureRoom(14);
      page.drawText('•', { x: ML + 2, y: cursorY, size: S.body, font: fBold, color: cDark });
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) ensureRoom(14);
        page.drawText(lines[i], { x: textX, y: cursorY, size: S.body, font: fReg, color: cDark });
        if (i < lines.length - 1) cursorY -= 13;
      }
      cursorY -= 14;
    }

    // ── SECTION 1 — Header ───────────────────────────────────────────────
    const rawName = profile.name.trim();
    let cleanName = rawName;
    if (rawName && profile.title.trim()) {
      const titleWords = profile.title.trim().toLowerCase().split(/\s+/);
      const nameWords = rawName.split(/\s+/);
      while (
        nameWords.length > 2 &&
        titleWords.includes(nameWords[nameWords.length - 1].toLowerCase())
      ) {
        nameWords.pop();
      }
      cleanName = nameWords.join(' ');
    }
    const displayName = cleanName || 'Portfolio Resume';
    const displayHeaderName =
      displayName === 'Portfolio Resume' ? displayName : displayName.toUpperCase();
    drawCenteredLine(displayHeaderName, {
      font: fBold, size: S.name + 1, color: cDark, maxWidth: CW, gapBelow: 6,
    });

    if (profile.title.trim()) {
      drawCenteredLine(profile.title.trim(), {
        font: fReg, size: S.title + 2, color: cMid, maxWidth: CW, gapBelow: 12,
      });
    }

    // Contact row with clickable links
    const contactItems: Array<{ text: string; link?: string }> = [];
    if (profile.phone.trim()) {
      let phoneVal = formatContactValue(profile.phone);
      const digits = phoneVal.replace(/\D/g, '');
      if (digits.length >= 9 && !phoneVal.startsWith('+')) {
        phoneVal = '+' + phoneVal.replace(/^0+/, '');
      }
      const d = phoneVal.replace(/\D/g, '');
      if (d.length >= 9) {
        phoneVal = '+' + d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
      }
      contactItems.push({ text: phoneVal, link: `tel:${phoneVal.replace(/\s+/g, '')}` });
    }
    if (profile.email.trim()) {
      const emailVal = formatContactValue(profile.email);
      contactItems.push({ text: emailVal, link: `mailto:${emailVal}` });
    }
    if (profile.linkedin.trim()) {
      const lnVal = formatContactValue(profile.linkedin);
      let lnLink = lnVal;
      if (!lnLink.startsWith('http')) lnLink = 'https://' + lnLink;
      contactItems.push({ text: lnVal, link: lnLink });
    }
    if (profile.portfolio.trim()) {
      const portVal = formatContactValue(profile.portfolio);
      const portLower = portVal.toLowerCase();
      const isCommonDomain = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'].includes(portLower);
      const isPartOfEmail = profile.email.toLowerCase().includes(portLower);
      if (!isCommonDomain && !isPartOfEmail && portVal.length >= 4) {
        let portLink = portVal;
        if (!portLink.startsWith('http')) portLink = 'https://' + portLink;
        contactItems.push({ text: portVal, link: portLink });
      }
    }

    if (contactItems.length > 0) {
      const size = S.meta + 0.5;
      const gapBelow = 10;
      const separator = '  |  ';
      const sepWidth = fReg.widthOfTextAtSize(separator, size);

      let totalWidth = 0;
      for (let i = 0; i < contactItems.length; i++) {
        totalWidth += fReg.widthOfTextAtSize(contactItems[i].text, size);
        if (i < contactItems.length - 1) totalWidth += sepWidth;
      }

      ensureRoom(size + gapBelow + 2);
      let curX = Math.max(ML, ML + (CW - totalWidth) / 2);

      for (let i = 0; i < contactItems.length; i++) {
        const item = contactItems[i];
        const itemWidth = fReg.widthOfTextAtSize(item.text, size);
        page.drawText(item.text, { x: curX, y: cursorY, size, font: fReg, color: cMid });
        if (item.link) {
          const linkAnnot = pdf.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [curX, cursorY - 2, curX + itemWidth, cursorY + size + 2],
            Border: [0, 0, 0],
            A: { Type: 'Action', S: 'URI', URI: PDFString.of(item.link) },
          });
          const annots = page.node.get(PDFName.of('Annots')) || pdf.context.obj([]);
          const annotsArray = pdf.context.lookup(annots);
          if (annotsArray && 'push' in annotsArray) {
            (annotsArray as { push: (val: unknown) => void }).push(linkAnnot);
          } else {
            page.node.set(PDFName.of('Annots'), pdf.context.obj([linkAnnot]));
          }
        }
        curX += itemWidth;
        if (i < contactItems.length - 1) {
          page.drawText(separator, { x: curX, y: cursorY, size, font: fReg, color: cMid });
          curX += sepWidth;
        }
      }
      cursorY -= size + gapBelow;
    }

    // Header divider
    cursorY -= 4;
    drawRule(0.8, cRule);
    cursorY -= 14;

    // ── SECTION 2 — Summary ──────────────────────────────────────────────
    const summaryText = (() => {
      const gen = (content.summary ?? '').trim();
      if (gen && gen !== 'Generated portfolio summary.') return gen;
      return profile.summary.trim();
    })();
    if (summaryText) {
      drawSectionHeader('Summary');
      drawBlock(summaryText, fReg, S.body, cDark, ML, CW, 4);
      cursorY -= 1;
    }

    // ── SECTION 3 — Skills & Keywords ────────────────────────────────────
    const contentWithCategories = content as unknown as {
      skillCategories?: Array<{ category?: string; skills?: string[] }>;
    };
    const skillCategories = (contentWithCategories.skillCategories ?? []).filter(
      (cat) => cat.category && cat.skills && cat.skills.length > 0
    );

    if (skillCategories.length > 0) {
      drawSectionHeader('Technical Skills');
      for (const cat of skillCategories) {
        const catName = (cat.category ?? 'Other').trim();
        const skills = (cat.skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 15);
        if (skills.length === 0) continue;
        const labelText = `${catName}:`;
        const labelWidth = fBold.widthOfTextAtSize(labelText, S.body);
        const skillsText = skills.join(', ');
        const skillsX = ML + labelWidth + 6;
        const skillsMaxW = CW - labelWidth - 6;
        ensureRoom(S.body + 8);
        page.drawText(labelText, { x: ML, y: cursorY, size: S.body, font: fBold, color: cDark });
        const skillLines = wrapText(skillsText, fReg, S.body, skillsMaxW);
        for (let i = 0; i < skillLines.length; i++) {
          if (i > 0) { cursorY -= S.body + 3; ensureRoom(S.body + 3); }
          page.drawText(skillLines[i], { x: i === 0 ? skillsX : ML + 12, y: cursorY, size: S.body, font: fReg, color: cDark });
        }
        cursorY -= S.body + 6;
      }
      cursorY -= 1;
    } else if (content.keywords && content.keywords.length > 0) {
      drawSectionHeader('Technical Skills');
      const skillsLine = content.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 28).join('  •  ');
      drawBlock(skillsLine, fReg, S.body, cDark, ML, CW, 4);
      cursorY -= 1;
    }

    const contentAny = content as unknown as Record<string, unknown>;
    const experienceAny = (contentAny.experience ?? contentAny.workExperience) as unknown;
    const projectsAny = contentAny.projects as unknown;
    const experienceEntries = Array.isArray(experienceAny) ? experienceAny : [];
    const projectEntries = Array.isArray(projectsAny) ? projectsAny : [];

    // ── SECTION 4 — Work Experience ──────────────────────────────────────
    if (experienceEntries.length > 0) {
      drawSectionHeader('Work Experience');
      for (const entry of experienceEntries.slice(0, 10)) {
        const e = entry as Record<string, unknown>;
        const role = String((e.role ?? e.title ?? '') as string).trim();
        const company = String((e.company ?? e.organization ?? e.employer ?? '') as string).trim();
        const duration = String((e.duration ?? e.dates ?? e.timeframe ?? '') as string).trim();
        const left = [role, company].filter(Boolean).join(' — ');
        const bulletsRaw = (e.bullets ?? e.highlights ?? e.achievements) as unknown;
        const bullets = Array.isArray(bulletsRaw) ? bulletsRaw.map((b) => String(b).trim()).filter(Boolean) : [];
        if (!left && bullets.length === 0) continue;
        drawLeftRightLine({ left: left || 'Role', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 4 });
        for (const bullet of bullets.slice(0, 5)) drawBullet(bullet);
        cursorY -= 2;
      }
    }

    // ── SECTION 5 — Projects ─────────────────────────────────────────────
    const shouldRenderProjectsFromStructured = projectEntries.length > 0;
    if (shouldRenderProjectsFromStructured) {
      drawSectionHeader('Projects');
      for (const entry of projectEntries.slice(0, 12)) {
        const p = entry as Record<string, unknown>;
        const name = String((p.name ?? p.title ?? '') as string).trim();
        const duration = String((p.duration ?? p.dates ?? p.timeframe ?? '') as string).trim();
        const techRaw = (p.techStack ?? p.tech ?? p.stack) as unknown;
        const tech = Array.isArray(techRaw) ? techRaw.map((t) => String(t).trim()).filter(Boolean) : [];
        const bulletsRaw = (p.bullets ?? p.highlights ?? p.achievements ?? p.descriptionBullets) as unknown;
        const bullets = Array.isArray(bulletsRaw) ? bulletsRaw.map((b) => String(b).trim()).filter(Boolean) : [];
        if (!name && bullets.length === 0) continue;
        drawLeftRightLine({ left: name || 'Project', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 2 });
        if (tech.length > 0) {
          const techLine = tech.slice(0, 18).join(' + ');
          drawBlock(`Stack: ${techLine}`, fReg, S.meta, cAccent, ML, CW, 3);
          cursorY -= 2;
        }
        for (const bullet of bullets.slice(0, 4)) drawBullet(bullet);
        cursorY -= 4;
      }
    }

    if (!shouldRenderProjectsFromStructured && content.sections && content.sections.length > 0) {
      drawSectionHeader('Projects');
      for (const section of content.sections) {
        const raw = section as unknown as {
          title?: string; bullets?: string[];
          duration?: string; dates?: string; timeframe?: string;
          techStack?: string[]; tech?: string[];
        };
        const name = (raw.title ?? '').trim();
        const duration = (raw.duration ?? raw.dates ?? raw.timeframe ?? '').trim();
        const tech = Array.isArray(raw.techStack) ? raw.techStack : Array.isArray(raw.tech) ? raw.tech : [];
        const bullets = (raw.bullets ?? []).map((b) => b.trim()).filter(Boolean);
        if (!name && bullets.length === 0) continue;
        drawLeftRightLine({ left: name || 'Project', right: duration, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 2 });
        if (tech.length > 0) {
          const techLine = tech.map((t) => t.trim()).filter(Boolean).slice(0, 18).join(' + ');
          if (techLine) { drawBlock(`Stack: ${techLine}`, fReg, S.meta, cAccent, ML, CW, 3); cursorY -= 2; }
        }
        for (const bullet of bullets.slice(0, 4)) drawBullet(bullet);
        cursorY -= 4;
      }
    }

    // ── SECTION 6 — Highlights ───────────────────────────────────────────
    if (content.resumeBullets && content.resumeBullets.length > 0) {
      drawSectionHeader('Highlights');
      for (const bullet of content.resumeBullets.slice(0, 8)) {
        if (bullet.trim()) drawBullet(bullet.trim());
      }
    }

    // ── SECTION 7 — Education ────────────────────────────────────────────
    if (profile.education && profile.education.length > 0) {
      const validEdu = profile.education.filter((e: { degree: string; institution: string }) =>
        e.degree.trim() || e.institution.trim()
      );
      if (validEdu.length > 0) {
        drawSectionHeader('Education');
        for (const edu of validEdu) {
          const degree = (edu.degree ?? '').trim();
          const inst = (edu.institution ?? '').trim();
          const year = (edu.year ?? '').trim();
          const headline = [degree, inst].filter(Boolean).join(' — ');
          if (!headline && !year) continue;
          drawLeftRightLine({
            left: headline, right: year,
            sizeLeft: S.body, sizeRight: S.meta, fontLeft: fBold, fontRight: fReg, gapBelow: 2,
          });
          cursorY -= 3;
        }
      }
    }

    // ── Footer on every page ─────────────────────────────────────────────
    const pageCount = pdf.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const p = pdf.getPage(i);
      p.drawLine({
        start: { x: ML, y: MB - 8 },
        end:   { x: PAGE_W - MR, y: MB - 8 },
        thickness: 0.4,
        color: cRule,
      });
      const label = `Page ${i + 1} of ${pageCount}`;
      const w = fReg.widthOfTextAtSize(label, S.small);
      p.drawText(label, { x: PAGE_W - MR - w, y: MB - 20, size: S.small, font: fReg, color: cMid });
    }

    // ── Serialise ─────────────────────────────────────────────────────────
    const bytes  = await pdf.save();
    const base64 = Buffer.from(bytes).toString('base64');

    await PortfolioFeedback.create({
      userId,
      generationId,
      eventType: 'export_pdf',
      metadata: { bytes: bytes.length },
    });

    return {
      fileName: `adjusted-resume-${generationId}.pdf`,
      base64,
    };
  });
}
