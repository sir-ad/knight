export interface SampleEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  type: 'confirmation' | 'interview' | 'rejection' | 'offer' | 'acknowledgment';
  platform?: string;
}

export const sampleEmails: SampleEmail[] = [
  {
    id: 'email-001',
    from: 'noreply@workday.com',
    to: 'alexandra.chen@email.com',
    subject: 'Application Received - Senior Software Engineer at TechCorp Inc.',
    body: `Dear Alexandra Chen,

Thank you for submitting your application for the Senior Software Engineer position at TechCorp Inc. through our Workday career portal.

Application Details:
- Position: Senior Software Engineer
- Job ID: JR-2024-12345
- Location: San Francisco, CA
- Submitted: March 1, 2024 at 2:30 PM PST

Your application has been received and will be reviewed by our hiring team. We will contact you within 5-7 business days regarding next steps.

You can check your application status anytime by logging into your Workday candidate profile.

Best regards,
TechCorp Inc. Talent Acquisition Team
Workday Candidate Experience`,
    date: '2024-03-01T14:30:00-08:00',
    type: 'confirmation',
    platform: 'workday'
  },
  {
    id: 'email-002',
    from: 'notifications@greenhouse.io',
    to: 'alexandra.chen@email.com',
    subject: 'Interview Invitation: Software Engineer at Innovation Labs',
    body: `Hi Alexandra,

We're excited to invite you to interview for the Software Engineer position at Innovation Labs!

Interview Details:
- Date: Monday, March 10, 2024
- Time: 10:00 AM - 11:30 AM PST
- Format: Video call (Google Meet)
- Interviewers: Sarah Johnson (Engineering Manager) and Mike Chen (Senior Developer)

The interview will consist of:
1. Technical discussion (45 min)
2. System design round (30 min)
3. Q&A with the team (15 min)

Please confirm your availability by clicking the link below:
https://greenhouse.io/schedule/confirm?token=abc123xyz

If the proposed time doesn't work, you can reschedule here:
https://greenhouse.io/schedule/reschedule?token=abc123xyz

We look forward to speaking with you!

Best,
Innovation Labs Recruiting Team
Powered by Greenhouse`,
    date: '2024-03-05T09:15:00-08:00',
    type: 'interview',
    platform: 'greenhouse'
  },
  {
    id: 'email-003',
    from: 'no-reply@naukri.com',
    to: 'alexandra.chen@email.com',
    subject: 'Update on your application - Developer position at GlobalTech Solutions',
    body: `Dear Candidate,

Thank you for your interest in the Developer position at GlobalTech Solutions.

After careful review of your application, we regret to inform you that we will not be proceeding with your candidacy at this time. We received a large number of qualified applicants and had to make difficult decisions.

We encourage you to apply for future openings that match your skills and experience. You can view our current openings at:
https://www.naukri.com/globaltechsolutions-careers

We wish you the best in your job search.

Regards,
GlobalTech Solutions HR Team
via Naukri.com`,
    date: '2024-02-28T11:45:00+05:30',
    type: 'rejection',
    platform: 'naukri'
  },
  {
    id: 'email-004',
    from: 'talent@dreamcompany.com',
    to: 'alexandra.chen@email.com',
    subject: 'Offer of Employment - Senior Software Engineer at DreamCompany',
    body: `Dear Alexandra,

We are delighted to extend this offer of employment for the position of Senior Software Engineer at DreamCompany!

OFFER DETAILS:

Position: Senior Software Engineer
Department: Engineering
Start Date: April 15, 2024
Location: San Francisco, CA (Hybrid - 3 days/week in office)

COMPENSATION:
Base Salary: $185,000/year
Annual Bonus Target: 15% ($27,750)
Sign-on Bonus: $15,000 (one-time)
Equity: 10,000 stock options (4-year vesting, 1-year cliff)

BENEFITS:
- Health, dental, and vision insurance (100% premium covered)
- 401(k) with 4% company match
- Unlimited PTO
- $2,000 annual learning & development budget
- Parental leave: 16 weeks paid

Please review the full offer details and accept/decline by March 15, 2024 through our portal:
https://dreamcompany.greenhouse.io/offer/accept?token=offer-xyz-123

If you have any questions, don't hesitate to reach out!

Warm regards,
Sarah Martinez
Senior Talent Acquisition Partner
DreamCompany`,
    date: '2024-03-08T16:00:00-08:00',
    type: 'offer'
  },
  {
    id: 'email-005',
    from: 'careers@techstartup.io',
    to: 'alexandra.chen@email.com',
    subject: 'Application Received - Full Stack Developer',
    body: `Hi Alexandra,

Thanks for applying to the Full Stack Developer role at TechStartup.io!

We've received your application and our team will review it shortly. We typically respond within 2 weeks.

In the meantime, feel free to:
- Check out our engineering blog: https://techstartup.io/engineering-blog
- Follow us on Twitter: @TechStartupEng
- Learn about our culture: https://techstartup.io/careers

Thanks again for your interest in joining our team!

The TechStartup.io Team`,
    date: '2024-03-02T08:20:00-08:00',
    type: 'acknowledgment'
  }
];

export const getEmailsByType = (type: SampleEmail['type']): SampleEmail[] => {
  return sampleEmails.filter(email => email.type === type);
};

export const getEmailsByPlatform = (platform: string): SampleEmail[] => {
  return sampleEmails.filter(email => email.platform === platform);
};

export const getEmailById = (id: string): SampleEmail | undefined => {
  return sampleEmails.find(email => email.id === id);
};
