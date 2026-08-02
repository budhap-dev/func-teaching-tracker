import { SiteContent } from '../models/siteContent'

/**
 * The content served until the teacher first publishes their own (REQ-008) —
 * the same copy the frontend has always shipped, so flipping the public pages
 * to the API changes nothing visibly. Also the graceful-degradation floor:
 * an empty store serves this, never a blank page.
 */
export const defaultSiteContent: SiteContent = {
    siteName: 'Springboard Tutoring',
    hero: {
        headline: 'Confident tutoring for Years 7 to 13.',
        subhead: 'One-to-one lessons in maths and the sciences, from KS3 through GCSE to A-level — in person or online, matched to your child’s exam board and built around their school week.',
        // Blank by default — the page hides the line until the teacher
        // publishes one via the site editor.
        availability: '',
        experienceYears: 20,
    },
    subjects: [
        {
            name: 'Mathematics',
            keyStages: ['KS3', 'GCSE', 'A-level'],
            examBoards: ['AQA', 'Edexcel', 'OCR'],
            modes: ['Online', 'In person'],
        },
        {
            name: 'Physics',
            keyStages: ['KS3', 'GCSE', 'A-level'],
            examBoards: ['AQA', 'OCR'],
            modes: ['Online', 'In person'],
        },
        {
            name: 'Chemistry',
            keyStages: ['KS3', 'GCSE', 'A-level'],
            examBoards: ['AQA', 'Edexcel'],
            modes: ['Online', 'In person'],
        },
        {
            name: 'Biology',
            keyStages: ['KS3', 'GCSE', 'A-level'],
            examBoards: ['AQA', 'OCR'],
            modes: ['Online', 'In person'],
        },
    ],
    journey: [
        {
            title: 'Enquire',
            detail: 'Tell us the subject, year and what your child wants to get out of tutoring.',
        },
        {
            title: 'Free assessment',
            detail: 'A no-obligation first session to find the gaps and agree what to focus on.',
        },
        {
            title: 'A matched plan',
            detail: 'Lessons mapped to the exam board and school scheme of work — not a generic syllabus.',
        },
        {
            title: 'Weekly sessions',
            detail: 'Regular lessons, each ending with a written note of what we covered and what to practise.',
        },
    ],
    approach: [
        {
            title: 'Grouped by year and subject',
            detail: 'Students are matched to the syllabus and exam board they are actually sitting, never to whatever slot happened to be free.',
        },
        {
            title: 'Progress recorded every session',
            detail: 'Each lesson ends with a written note: what we covered, what went well, and what to practise before next time.',
        },
        {
            title: 'Planned around school, not on top of it',
            detail: 'Lessons follow the school scheme of work, so tutoring reinforces the week rather than competing with it.',
        },
        {
            title: 'Parents kept in the loop',
            detail: 'You get a clear picture of where your child stands, without having to ask for it.',
        },
    ],
    // Empty until the teacher writes one — an empty section renders nothing.
    freeform: { heading: '', markdown: '' },
    sectionOrder: ['hero', 'subjects', 'journey', 'approach', 'freeform'],
}
