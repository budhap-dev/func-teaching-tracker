import { SiteContent } from '../models/siteContent'

/**
 * The content served until the teacher first publishes their own (REQ-008) —
 * the same copy the frontend has always shipped, so flipping the public pages
 * to the API changes nothing visibly. Also the graceful-degradation floor:
 * an empty store serves this, never a blank page.
 */
export const defaultSiteContent: SiteContent = {
    siteName: 'AbhiTutor',
    hero: {
        headline: 'Confident tutoring for Years 7 to 13.',
        subhead: 'One-to-one or small-group lessons in maths and the sciences, from KS3 through GCSE to A-level — in person or online, matched to your child’s exam board and built around their school week.',
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
            detail: 'Tell me the subject, year and what your child wants to get out of tutoring.',
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
    // Empty until the teacher writes it — an empty bio renders nothing, and
    // the DBS indicator is only ever switched on by the owner (REQ-021).
    // The owner's About copy (provided 2026-08-04, lightly tidied). Serves
    // fresh environments; an existing published document keeps its own bio
    // until the owner loads + publishes this from the About page.
    bio: {
        heading: 'About me',
        // No photo in the prepared copy — the owner uploads their own.
        photo: '',
        body: 'Hello, and welcome! 👋\n\nMy name is **Mrs Abhinanda Pandit**, and I currently work in a secondary school in Leeds as a **Maths Mentor**. Before that I was an **Assistant SENDCo**, supporting students with additional learning needs and helping them overcome barriers to success.\n\nTeaching has always been more than a profession for me — it is my passion. ❤️ My love of working with young people and helping them reach their full potential inspired me to offer private tutoring, both online and in person from my home in the Middleton area of Leeds.\n\nMy journey as a tutor began in my own student years, helping fellow students and junior batches with Physics honours and much else besides. That early experience lit a lifelong passion for teaching and mentoring. ✨',
        qualifications: [
            'BSc (Hons) Physics, First Class',
            'B.Tech Computer Science — University Topper',
            '20+ years teaching and tutoring',
        ],
        dbsChecked: false,
        safeguarding: '',
        experience: [
            {
                years: 'Now',
                title: 'Maths Mentor',
                place: 'Secondary school, Leeds',
                detail: 'Previously Assistant SENDCo — supporting students with additional learning needs.',
            },
            {
                years: 'Since 2019',
                title: 'Tutor across the UK',
                place: 'Tutoring centre and privately',
                detail: 'Helping students build confidence, improve grades, and genuinely understand their subjects.',
            },
            {
                years: 'Earlier',
                title: 'Teacher at several schools',
                place: 'India, before moving to the UK',
                detail: 'Left a software career at a multinational because the pull of the classroom was stronger.',
            },
        ],
        // Education lives on the qualification cards (owner call) —
        // an empty list hides the timeline block.
        education: [],
        expectations: [
            'Personalised one-to-one tuition',
            'Patient and supportive teaching',
            'Tailored learning plans',
            'Regular progress feedback',
            'Focus on understanding, not memorising',
            'Proven exam preparation strategies',
            'A commitment to helping every student achieve their best',
        ],
        sections: [
            {
                heading: 'My teaching philosophy',
                markdown: '✨ ***Every student has the potential to succeed with the right guidance, encouragement and support.***\n\n- 🎯 Every lesson is tailored to individual needs, learning styles and goals.\n- 🤗 A safe, supportive space where it is always okay to ask questions and make mistakes.\n- 🌱 Confidence, resilience and a positive attitude to learning — not just marks.',
            },
            {
                heading: 'My promise',
                markdown: '- 🌱 Learning is not about being the best — it is about becoming better than you were yesterday.\n- 💪 Confidence is the foundation of success, and every lesson is designed to build it.\n- 🤝 Together, we can turn challenges into achievements and goals into results.\n- ⭐ More than improving grades, my goal is to help students believe in themselves.\n\nI look forward to supporting your child on their educational journey. 😊',
            },
        ],
    },
    // A starter set the owner reviews and edits before publishing (REQ-025).
    // Every answer sticks to what the site already claims — no invented
    // policies, prices or promises.
    faq: [
        {
            question: 'What subjects and levels do you cover?',
            answer: 'Maths and the sciences, from KS3 through GCSE to A-level. Lessons follow your child’s own exam board and specification, not a generic syllabus.',
        },
        {
            question: 'Are lessons online or in person?',
            answer: 'Both — choose whichever suits your family, or mix the two. Online lessons are live and interactive, never pre-recorded.',
        },
        {
            question: 'Are lessons one-to-one or in groups?',
            answer: 'Most lessons are one-to-one. Small group sessions also run where a few students at the same level learn well together.',
        },
        {
            question: 'How do we get started?',
            answer: 'Request a free assessment. We talk through where your child is now and what success looks like, then agree a plan — no commitment until you’re happy.',
        },
        {
            question: 'How will we know it’s working?',
            answer: 'Every lesson ends with a written note of what was covered and what to practise, and progress is reviewed against the goals we agree at the start — you stay in the loop without having to ask.',
        },
    ],
    // Transparent pricing (REQ-022): the owner's anchor, with the factors
    // NAMED (never fake-quantified) and the honest close.
    pricing: {
        // The owner's anchors (2026-08-04): rates rise with the years.
        rates: [
            { label: 'GCSE', fromPerHour: 20 },
            { label: 'A-level', fromPerHour: 30 },
        ],
        factors: [
            {
                title: 'One-to-one or small group',
                detail: 'Group lessons share the hour — and the rate — between students.',
            },
            {
                title: 'Online or in person',
                detail: 'In-person lessons may reflect travel; online carries no extras.',
            },
        ],
        note: 'Your exact rate is agreed at the free assessment — no obligation, no surprises.',
    },
    // Hero highlights (REQ-038): the owner's list (2026-08-05), deduped —
    // progress updates + parent communication merged; UK spelling.
    highlights: [
        'Flexible scheduling',
        'Clear communication with parents',
        'Regular progress reports',
        'Online convenience',
        'Personalised learning',
        'Confidence-building approach',
        'Exam and assessment preparation',
        'Proven results',
    ],
    // The subject cards' third tag label — renameable by the owner.
    modesLabel: 'Delivery',
    // The phone tab bar (REQ-049): three flat slots + the raised
    // spotlight; 'menu' is always the fifth tab.
    mobileNav: {
        items: ['home', 'offerings', 'pricing'],
        spotlight: 'enquire',
    },
    // The Offerings services checklist — the owner's list, verbatim
    // (2026-08-07); the view supplies the ticks.
    services: [
        'One-to-One Personalised Tutoring',
        'Small Group Classes for Focused Learning',
        'Homework & Assignment Support',
        'Exam Preparation and Revision Strategies',
        'Confidence Building & Study Skills Development',
        'Progress Tracking and Parent Feedback',
        'Foundation, Intermediate & Advanced Learning Support',
        'GCSE & A-Level Preparation',
        'Flexible In-Person and Online Sessions',
    ],
    // Empty until the teacher writes one — an empty section renders nothing.
    freeform: { heading: '', markdown: '' },
    sectionOrder: [
        'hero',
        'subjects',
        'journey',
        'approach',
        'bio',
        'faq',
        'freeform',
    ],
}
