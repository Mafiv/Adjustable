import { PDFDocument, StandardFonts, rgb, PDFName, PDFString } from 'pdf-lib';
import type { GenerationOutput } from '@/lib/cv-generation';
import type { CvProfile } from '@/lib/cv-profile';
import { formatEducationDateRange, formatLanguagesForDisplay } from '@/lib/cv-profile';
import { isRefusalOrMetaText } from '@/lib/cv-generation-guards';

type RenderStats = Record<string, { expected: number; rendered: number }>;

export async function buildCvPdf(content: GenerationOutput, profile: CvProfile) {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const ML = 52;
  const MR = 52;
  const MT = 54;
  const MB = 48;
  const CW = PAGE_W - ML - MR;

  const cDark = rgb(0.11, 0.09, 0.09);
  const cMid = rgb(0.47, 0.44, 0.42);
  const cAccent = rgb(0.4, 0.22, 0.06);
  const cRule = rgb(0.87, 0.85, 0.84);

  const pdf = await PDFDocument.create();
  const fReg = await pdf.embedFont(StandardFonts.Helvetica);
  const fBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fBoldOblique = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MT;
  const stats: RenderStats = {};

  const S = {
    name: 22,
    title: 12,
    meta: 9.25,
    section: 10,
    subhead: 11,
    body: 10,
    small: 8,
  };

  function wrapText(text: string, font: typeof fReg, size: number, maxWidth: number) {
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

  function drawRule(thickness = 0.6, color = cRule) {
    page.drawLine({
      start: { x: ML, y: cursorY },
      end: { x: PAGE_W - MR, y: cursorY },
      thickness,
      color,
    });
  }

  function drawSectionHeader(label: string) {
    ensureRoom(34);
    cursorY -= 12;
    page.drawText(label.toUpperCase(), {
      x: ML,
      y: cursorY,
      size: S.section,
      font: fBold,
      color: cDark,
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

  function formatContactValue(value: string) {
    return value
      .trim()
      .replace(/^mailto:/i, '')
      .replace(/^tel:/i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '');
  }

  function drawCenteredLine(text: string, size: number, font: typeof fReg, gapBelow: number) {
    const trimmed = text.trim();
    if (!trimmed) return;
    ensureRoom(size + gapBelow + 2);
    const width = font.widthOfTextAtSize(trimmed, size);
    page.drawText(trimmed, {
      x: Math.max(ML, ML + (CW - width) / 2),
      y: cursorY,
      size,
      font,
      color: cDark,
    });
    cursorY -= size + gapBelow;
  }

  // ── 1. Header ───────────────────────────────────────────────────────────
  const displayName = profile.name.trim() || 'Portfolio Resume';
  drawCenteredLine(
    displayName === 'Portfolio Resume' ? displayName : displayName.toUpperCase(),
    S.name + 1,
    fBold,
    8
  );

  const contactParts = [profile.phone, profile.email, profile.location]
    .map((value) => formatContactValue(value))
    .filter(Boolean);
  if (contactParts.length > 0) {
    drawCenteredLine(contactParts.join('  |  '), S.meta + 0.5, fReg, 8);
  }

  const linkParts = [
    profile.linkedin ? { label: 'LinkedIn', value: profile.linkedin } : null,
    profile.github ? { label: 'GitHub', value: profile.github } : null,
    profile.portfolio ? { label: 'Portfolio', value: profile.portfolio } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (linkParts.length > 0) {
    drawCenteredLine(
      linkParts.map((item) => formatContactValue(item.value)).join('  |  '),
      S.meta,
      fReg,
      10
    );
  }

  cursorY -= 4;
  drawRule(0.8, cRule);
  cursorY -= 14;

  // ── 2. Summary ────────────────────────────────────────────────────────
  const summaryText =
    content.summary.trim() && content.summary.trim() !== 'Generated portfolio summary.'
      ? content.summary.trim()
      : profile.summary.trim();

  if (summaryText) {
    drawSectionHeader('Summary');
    drawBlock(summaryText, fReg, S.body, cDark, ML, CW, 4);
    cursorY -= 2;
  }

  // ── 3. Work Experience ────────────────────────────────────────────────
  const workEntries = content.workExperience.filter(
    (entry) =>
      (entry.company || entry.role || entry.bullets.length > 0) &&
      !isRefusalOrMetaText(entry.company) &&
      !isRefusalOrMetaText(entry.role)
  );
  stats.workExperience = { expected: content.workExperience.length, rendered: 0 };

  if (workEntries.length > 0) {
    drawSectionHeader('Work Experience');
    for (const entry of workEntries) {
      drawLeftRightLine({
        left: entry.company || 'Organization',
        right: entry.dates,
        sizeLeft: S.subhead,
        fontLeft: fBold,
        gapBelow: 3,
      });
      drawLeftRightLine({
        left: entry.role || 'Role',
        right: entry.location,
        sizeLeft: S.body,
        fontLeft: fBoldOblique,
        gapBelow: 4,
      });
      let renderedBullets = 0;
      for (const bullet of entry.bullets) {
        if (!bullet.trim() || isRefusalOrMetaText(bullet)) continue;
        drawBullet(bullet.trim());
        renderedBullets += 1;
      }
      stats.workExperience.rendered += renderedBullets > 0 ? 1 : 0;
      cursorY -= 4;
    }
  }

  // ── 4. Projects ───────────────────────────────────────────────────────
  const projectEntries = content.projects.filter(
    (entry) =>
      (entry.title || entry.description || (entry.bullets?.length ?? 0) > 0) &&
      !isRefusalOrMetaText(entry.title ?? '') &&
      !(entry.description && isRefusalOrMetaText(entry.description))
  );
  stats.projects = { expected: content.projects.length, rendered: 0 };

  if (projectEntries.length > 0) {
    drawSectionHeader('Projects');
    for (const project of projectEntries) {
      ensureRoom(S.subhead + 8);
      page.drawText(project.title || 'Project', {
        x: ML,
        y: cursorY,
        size: S.subhead,
        font: fBold,
        color: cDark,
      });
      cursorY -= S.subhead + 4;

      if (project.description?.trim()) {
        drawBlock(project.description.trim(), fReg, S.body, cDark, ML, CW, 3);
      }

      for (const bullet of project.bullets ?? []) {
        if (!bullet.trim() || isRefusalOrMetaText(bullet)) continue;
        drawBullet(bullet.trim());
      }
      stats.projects.rendered += 1;
      cursorY -= 2;
    }
  } else if (workEntries.length === 0 && content.sections.length > 0) {
    drawSectionHeader('Projects');
    for (const section of content.sections) {
      if (isRefusalOrMetaText(section.title)) continue;
      drawLeftRightLine({ left: section.title, sizeLeft: S.subhead, fontLeft: fBold, gapBelow: 3 });
      for (const bullet of section.bullets) {
        if (!isRefusalOrMetaText(bullet)) drawBullet(bullet);
      }
      stats.projects = { expected: content.sections.length, rendered: content.sections.length };
      cursorY -= 2;
    }
  }

  // ── 5. Education ──────────────────────────────────────────────────────
  const educationEntries = profile.education.filter(
    (entry) =>
      entry.institution ||
      entry.degree ||
      entry.startDate ||
      entry.endDate
  );
  stats.education = { expected: educationEntries.length, rendered: 0 };

  if (educationEntries.length > 0) {
    drawSectionHeader('Education');
    for (const edu of educationEntries) {
      const dateLine = formatEducationDateRange(edu.startDate, edu.endDate);
      drawLeftRightLine({
        left: edu.institution || edu.degree,
        right: dateLine,
        sizeLeft: S.subhead,
        fontLeft: fBold,
        gapBelow: 3,
      });
      if (edu.institution && edu.degree) {
        drawLeftRightLine({
          left: edu.degree,
          right: edu.location,
          sizeLeft: S.body,
          fontLeft: fReg,
          gapBelow: 3,
        });
      } else if (edu.location?.trim()) {
        drawLeftRightLine({
          left: '',
          right: edu.location,
          sizeLeft: S.body,
          fontLeft: fReg,
          gapBelow: 3,
        });
      }
      if (edu.honors?.trim()) {
        drawBullet(`Honors: ${edu.honors.trim()}`);
      }
      if (edu.coursework?.trim()) {
        drawBullet(`Coursework: ${edu.coursework.trim()}`);
      }
      stats.education.rendered += 1;
      cursorY -= 2;
    }
  }

  // ── 6. Skills ─────────────────────────────────────────────────────────
  const skillCategories = (content.skillCategories ?? []).filter(
    (cat) => cat.category && cat.skills.length > 0
  );
  stats.skills = { expected: skillCategories.length, rendered: 0 };

  if (skillCategories.length > 0) {
    drawSectionHeader('Skills');
    for (const cat of skillCategories) {
      const label = `${cat.category} :`;
      const skillsText = cat.skills.join(', ');
      const labelWidth = fBold.widthOfTextAtSize(label, S.body);
      const lines = wrapText(skillsText, fReg, S.body, CW - labelWidth - 6);
      ensureRoom(S.body + 6);
      page.drawText(label, { x: ML, y: cursorY, size: S.body, font: fBold, color: cDark });
      page.drawText(lines[0] ?? '', {
        x: ML + labelWidth + 4,
        y: cursorY,
        size: S.body,
        font: fReg,
        color: cDark,
      });
      cursorY -= S.body + 4;
      for (let i = 1; i < lines.length; i++) {
        drawBlock(lines[i], fReg, S.body, cDark, ML + 12, CW - 12, 3);
      }
      stats.skills.rendered += 1;
    }
  } else {
    const keywordSkills = content.keywords
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0 && keyword.toLowerCase() !== 'portfolio');
    if (keywordSkills.length >= 3) {
      drawSectionHeader('Skills');
      drawBlock(`Other : ${keywordSkills.join(', ')}`, fReg, S.body, cDark, ML, CW, 4);
      stats.skills = { expected: 1, rendered: 1 };
    }
  }

  // ── 7. Languages ──────────────────────────────────────────────────────
  const languagesLine = formatLanguagesForDisplay(profile.languages);
  if (languagesLine) {
    drawSectionHeader('Languages');
    drawBlock(languagesLine, fReg, S.body, cDark, ML, CW, 4);
  }

  const pageCount = pdf.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdf.getPage(i);
    p.drawLine({
      start: { x: ML, y: MB - 8 },
      end: { x: PAGE_W - MR, y: MB - 8 },
      thickness: 0.4,
      color: cRule,
    });
    const label = `Page ${i + 1} of ${pageCount}`;
    const w = fReg.widthOfTextAtSize(label, S.small);
    p.drawText(label, {
      x: PAGE_W - MR - w,
      y: MB - 20,
      size: S.small,
      font: fReg,
      color: cMid,
    });
  }

  if (process.env.CV_PDF_DEBUG === 'true') {
    console.log(
      JSON.stringify({
        level: 'info',
        operation: 'cv.pdf.renderStats',
        timestamp: new Date().toISOString(),
        context: stats,
      })
    );
  }

  const bytes = await pdf.save();
  return {
    bytes,
    base64: Buffer.from(bytes).toString('base64'),
    renderStats: stats,
    pageCount,
  };
}
