// Fictional sample profile served at /demo so visitors can see the output before signing up.
export const DEMO = {
  name: "Maya Okafor",
  headline: "Senior PM building AI-assisted workflows for B2B finance teams",
  location: "Bengaluru, India",
  email: "",
  avatarUrl: "",
  openToWork: true,
  theme: "paper",
  about:
    "I've spent eight years turning messy back-office processes into products people actually enjoy using. Most recently I led invoice automation at a Series C fintech, where I took an ML prototype to a product that now processes a third of our volume. I like small teams, sharp problem statements and shipping on Thursdays.",
  feedUrl: "",
  links: { linkedin: "https://www.linkedin.com/", website: "", twitter: "", producthunt: "https://www.producthunt.com/", substack: "", medium: "", github: "" },
  metrics: [
    { value: "34%", label: "of invoices now fully auto-processed" },
    { value: "$4.1M", label: "new ARR from the AP Automation add-on" },
    { value: "-62%", label: "time-to-close for finance teams" },
    { value: "3", label: "zero-to-one products launched" },
  ],
  products: [
    {
      name: "Smart Capture", company: "Ledgerly", year: "2024", summary: "",
      problem: "Finance teams hand-keyed 70% of invoices because our OCR broke on anything but clean PDFs.",
      action: "Partnered with ML to ship a confidence-scored extraction model with a one-click review queue; ran a 6-week beta with 40 customers.",
      outcome: "Auto-processing rose from 9% to 34% of volume and support tickets on data entry fell by half.",
      link: "", tags: ["AI/ML", "B2B", "0→1"],
    },
    {
      name: "AP Automation add-on", company: "Ledgerly", year: "2023", summary: "",
      problem: "Mid-market customers churned to suites that bundled approvals and payments.",
      action: "Defined pricing and packaging, cut scope to approvals + scheduled payments for v1, and launched with sales enablement.",
      outcome: "$4.1M new ARR in the first year with 18% attach rate on new deals.",
      link: "", tags: ["Monetisation", "Fintech"],
    },
    {
      name: "Close Checklist", company: "Tallybook", year: "2021", summary: "",
      problem: "Month-end close lived in spreadsheets and Slack threads, taking 9 days on average.",
      action: "Ran 30 discovery interviews, prototyped in Figma, shipped a collaborative checklist with ERP sync.",
      outcome: "Average close dropped to 3.4 days; became the #1 cited reason for upgrades.",
      link: "", tags: ["Discovery", "Collaboration"],
    },
  ],
  experience: [
    { role: "Senior Product Manager", company: "Ledgerly", start: "Jan 2022", end: "", summary: "Lead PM for accounts payable — 2 squads, 14 engineers.", highlights: ["Launched Smart Capture and AP Automation", "Set up the team's experimentation framework"] },
    { role: "Product Manager", company: "Tallybook", start: "Jun 2019", end: "Dec 2021", summary: "First PM hire; owned the close-management product line.", highlights: ["Grew paid accounts from 120 to 900", "Built discovery and research cadence from scratch"] },
    { role: "Business Analyst", company: "Deloitte", start: "Jul 2016", end: "May 2019", summary: "Finance transformation projects for FMCG clients.", highlights: [] },
  ],
  education: [{ school: "IIM Bangalore", degree: "MBA", years: "2014 – 2016" }],
  skills: ["Discovery", "Experimentation", "Pricing & packaging", "SQL", "Roadmapping", "Stakeholder alignment"],
  domains: ["Fintech", "B2B SaaS", "AI/ML products"],
  writing: [
    { title: "Shipping ML features your users will trust", url: "https://example.com", date: "2025-09-02" },
    { title: "The one-page PRD we actually use", url: "https://example.com", date: "2025-05-14" },
  ],
};
