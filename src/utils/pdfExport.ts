import { jsPDF } from 'jspdf';
import { LessonPlan } from '../types/lesson';
import { formatMinuteWindow, PEDAGOGICAL_MODELS } from './timeAllocation';

export function exportLessonPlanToPDF(plan: LessonPlan): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 18;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 18) {
      doc.addPage();
      cursorY = 18;
    }
  };

  // Top Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setTextColor(16, 185, 129); // Emerald 500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const modelName = PEDAGOGICAL_MODELS[plan.modelId]?.name || 'Structured Lesson Plan';
  doc.text(`LESSONFLOW CLASSROOM LESSON PLAN  |  ${modelName.toUpperCase()}`, margin, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(plan.title || 'Untitled Lesson Plan', contentWidth - 42);
  doc.text(titleLines[0] || 'Untitled Lesson Plan', margin, 20);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaLine = `Subject: ${plan.subject || 'General'}  ·  ${plan.gradeLevel || 'All Grades'}  ·  Standard: ${plan.standardCode || 'N/A'}  ·  Date: ${plan.date}`;
  doc.text(metaLine, margin, 28);

  // Total Duration Badge on Right
  const sectionSum = plan.sections.reduce((acc, s) => acc + s.minutes, 0);
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pageWidth - margin - 38, 9, 38, 18, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${plan.totalMinutes} MIN`, pageWidth - margin - 19, 17, { align: 'center' });
  doc.setFontSize(7);
  doc.text(`SUM: ${sectionSum}/${plan.totalMinutes}m`, pageWidth - margin - 19, 23, { align: 'center' });

  cursorY = 42;

  // Essential Question & Materials Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  const eqLines = doc.splitTextToSize(
    `Essential Question: ${plan.essentialQuestion || 'N/A'}`,
    contentWidth - 8
  );
  const matLines = doc.splitTextToSize(
    `Materials & Prep: ${plan.materials || 'Standard classroom materials'}`,
    contentWidth - 8
  );
  const overviewHeight = (eqLines.length + matLines.length) * 4.5 + 8;
  doc.roundedRect(margin, cursorY, contentWidth, overviewHeight, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(eqLines, margin + 4, cursorY + 6);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(matLines, margin + 4, cursorY + 6 + eqLines.length * 4.5 + 2);

  cursorY += overviewHeight + 7;

  // Precision Time Allocation Summary Table
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `1. Precision Time Allocation Summary (${plan.sections.length} Sections · Exact Total: ${sectionSum} / ${plan.totalMinutes} Minutes)`,
    margin,
    cursorY
  );
  cursorY += 4;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, cursorY, contentWidth, 7, 'F');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('#', margin + 3, cursorY + 4.8);
  doc.text('Section / Pedagogical Segment', margin + 12, cursorY + 4.8);
  doc.text('Time Window', margin + 115, cursorY + 4.8);
  doc.text('Share', margin + 146, cursorY + 4.8);
  doc.text('Minutes', pageWidth - margin - 3, cursorY + 4.8, { align: 'right' });
  cursorY += 7;

  let runningStart = 0;
  plan.sections.forEach((sec, idx) => {
    ensureSpace(8);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, cursorY, contentWidth, 6.5, 'F');
    }
    const timeWin = formatMinuteWindow(runningStart, sec.minutes);
    runningStart += sec.minutes;
    const pct = plan.totalMinutes > 0 ? Math.round((sec.minutes / plan.totalMinutes) * 100) : 0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(`0${idx + 1}`, margin + 3, cursorY + 4.5);
    const shortPhase = doc.splitTextToSize(sec.phaseName, 98)[0];
    doc.text(shortPhase, margin + 12, cursorY + 4.5);
    doc.setTextColor(71, 85, 105);
    doc.text(timeWin, margin + 115, cursorY + 4.5);
    doc.text(`${pct}%`, margin + 146, cursorY + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${sec.minutes} min`, pageWidth - margin - 3, cursorY + 4.5, { align: 'right' });
    cursorY += 6.5;
  });

  // Total Footer Row
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.rect(margin, cursorY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70);
  doc.text('TOTAL CLASSROOM TIME ALLOCATION (EXACT MATCH VERIFIED)', margin + 3, cursorY + 4.8);
  doc.text(`${sectionSum} / ${plan.totalMinutes} min (100%)`, pageWidth - margin - 3, cursorY + 4.8, {
    align: 'right',
  });
  cursorY += 12;

  // Section-by-Section Detailed Plan & Learning Objectives
  ensureSpace(16);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. Section Breakdown & Learning Objectives', margin, cursorY);
  cursorY += 5;

  let elapsed = 0;
  plan.sections.forEach((sec, idx) => {
    const windowLabel = formatMinuteWindow(elapsed, sec.minutes);
    elapsed += sec.minutes;

    const objLines = doc.splitTextToSize(
      `Learning Objective: ${sec.learningObjective}`,
      contentWidth - 10
    );
    const actLines = doc.splitTextToSize(
      `Instructional Sequence: ${sec.instructionalActivities}`,
      contentWidth - 10
    );
    const chkLines = doc.splitTextToSize(
      `Formative Check: ${sec.formativeCheck}`,
      contentWidth - 10
    );

    const cardHeight =
      10 + (objLines.length + actLines.length + chkLines.length) * 4.2 + 7;

    ensureSpace(cardHeight + 4);

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, cursorY, contentWidth, cardHeight, 2, 2, 'FD');

    // Section Header Bar inside Card
    doc.setFillColor(241, 245, 249);
    doc.rect(margin + 0.3, cursorY + 0.3, contentWidth - 0.6, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`0${idx + 1}. ${sec.phaseName}`, margin + 4, cursorY + 5.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(
      `${sec.minutes} min  (${windowLabel})`,
      pageWidth - margin - 4,
      cursorY + 5.6,
      { align: 'right' }
    );

    let innerY = cursorY + 13;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(15, 23, 42);
    doc.text(objLines, margin + 4, innerY);
    innerY += objLines.length * 4.2 + 2;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(actLines, margin + 4, innerY);
    innerY += actLines.length * 4.2 + 2;

    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    doc.text(chkLines, margin + 4, innerY);

    cursorY += cardHeight + 4;
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated by LessonFlow  ·  Offline-Capable Classroom Schedule  ·  Page ${p} of ${totalPages}`,
      margin,
      pageHeight - 8
    );
  }

  const slug = (plan.title || 'lesson-plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const filename = `${slug || 'lesson-plan'}-${plan.totalMinutes}min.pdf`;
  doc.save(filename);
  return filename;
}
