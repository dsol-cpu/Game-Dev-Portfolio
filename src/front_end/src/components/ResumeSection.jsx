import { createMemo } from "solid-js";

const ResumeSection = (props) => {
  const isDark = props.isDark;

  const styles = createMemo(() => ({
    container: `${isDark() ? "text-blue-100" : "text-blue-900"}`,
    sectionContainer: `flex flex-col md:flex-row gap-8`,
    leftColumn: `w-full md:w-2/3`,
    rightColumn: `w-full md:w-1/3`,
    section: `mb-8`,
    sectionHeading: `text-2xl font-bold ${isDark() ? "text-blue-300" : "text-blue-700"} mb-4 border-b pb-2 ${isDark() ? "border-blue-800" : "border-blue-200"}`,
    experienceItem: `mb-6`,
    jobTitle: `text-xl font-semibold ${isDark() ? "text-blue-200" : "text-blue-800"}`,
    company: `text-lg flex items-center justify-between`,
    companyName: `italic ${isDark() ? "text-blue-300" : "text-blue-600"}`,
    period: `text-sm ${isDark() ? "text-blue-400" : "text-blue-500"} mb-2`,
    description: `${isDark() ? "text-gray-300" : "text-gray-700"} mb-2`,
    bulletPoints: `space-y-1 ml-1 mt-2`,
    bulletPoint: `flex items-start`,
    bullet: `${isDark() ? "text-blue-400" : "text-blue-500"} mr-2 mt-1`,
    bulletText: `${isDark() ? "text-gray-300" : "text-gray-700"}`,
    skillSection: `mt-4`,
    skillHeading: `font-semibold ${isDark() ? "text-blue-300" : "text-blue-700"} mb-2`,
    skillList: `flex flex-wrap gap-2`,
    skill: `px-3 py-1 rounded-full text-sm ${
      isDark() ? "bg-blue-800 text-blue-200" : "bg-blue-100 text-blue-800"
    }`,
    infoBlock: `mb-4 p-4 rounded-lg ${
      isDark() ? "bg-blue-900/50" : "bg-blue-50"
    }`,
    infoTitle: `font-semibold ${isDark() ? "text-blue-200" : "text-blue-800"} mb-1`,
    infoDetail: `${isDark() ? "text-blue-300" : "text-blue-700"}`,
    contactInfo: `flex items-center mb-2`,
    icon: `mr-2 ${isDark() ? "text-blue-400" : "text-blue-600"}`,
    downloadButton: `w-full mt-4 px-4 py-2 rounded-lg font-medium transition-colors ${
      isDark()
        ? "bg-blue-700 text-white hover:bg-blue-600"
        : "bg-blue-500 text-white hover:bg-blue-400"
    }`,
  }));

  // Resume data - typically would be moved to a separate file
  const resumeData = {
    personal: {
      name: "John Developer",
      title: "Senior Frontend Developer",
      email: "john@example.com",
      phone: "(555) 123-4567",
      location: "San Francisco, CA",
      website: "johndeveloper.com",
    },
    experience: [
      {
        title: "Senior Frontend Developer",
        company: "TechCorp Inc.",
        period: "January 2022 - Present",
        description:
          "Leading development of responsive web applications using modern technologies",
        achievements: [
          "Implemented component-based architecture using SolidJS and other frameworks",
          "Improved page load performance by 40% through optimization techniques",
          "Mentored junior developers and conducted code reviews",
          "Implemented CI/CD pipelines to enhance deployment efficiency",
        ],
        skills: ["SolidJS", "TypeScript", "TailwindCSS", "API Integration"],
      },
      {
        title: "Frontend Developer",
        company: "WebSolutions LLC",
        period: "March 2019 - December 2021",
        description:
          "Developed and maintained client websites and web applications",
        achievements: [
          "Built responsive user interfaces for over 20 client projects",
          "Collaborated with designers to implement pixel-perfect designs",
          "Optimized web performance and accessibility compliance",
        ],
        skills: ["JavaScript", "React", "CSS/SCSS", "Responsive Design"],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "University of Technology",
        period: "2015 - 2019",
        description: "Focus on Web Development and UI/UX Design",
      },
    ],
    skills: [
      "SolidJS",
      "React",
      "Vue",
      "TypeScript",
      "JavaScript",
      "HTML5",
      "CSS3/SCSS",
      "TailwindCSS",
      "Git",
      "Responsive Design",
      "Performance Optimization",
      "RESTful APIs",
    ],
    languages: ["English (Native)", "Spanish (Proficient)"],
    certifications: [
      "AWS Certified Developer",
      "Google Professional Web Developer",
    ],
  };

  return (
    <div class={styles().container}>
      <div class={styles().sectionContainer}>
        <div class={styles().leftColumn}>
          {/* Experience Section */}
          <div class={styles().section}>
            <h3 class={styles().sectionHeading}>Professional Experience</h3>

            {resumeData.experience.map((job) => (
              <div class={styles().experienceItem}>
                <div class={styles().jobTitle}>{job.title}</div>
                <div class={styles().company}>
                  <span class={styles().companyName}>{job.company}</span>
                  <span class={styles().period}>{job.period}</span>
                </div>
                <p class={styles().description}>{job.description}</p>

                <div class={styles().bulletPoints}>
                  {job.achievements.map((achievement) => (
                    <div class={styles().bulletPoint}>
                      <span class={styles().bullet}>•</span>
                      <span class={styles().bulletText}>{achievement}</span>
                    </div>
                  ))}
                </div>

                <div class={styles().skillSection}>
                  <div class={styles().skillList}>
                    {job.skills.map((skill) => (
                      <span class={styles().skill}>{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Education Section */}
          <div class={styles().section}>
            <h3 class={styles().sectionHeading}>Education</h3>
            {resumeData.education.map((edu) => (
              <div class={styles().experienceItem}>
                <div class={styles().jobTitle}>{edu.degree}</div>
                <div class={styles().company}>
                  <span class={styles().companyName}>{edu.institution}</span>
                  <span class={styles().period}>{edu.period}</span>
                </div>
                <p class={styles().description}>{edu.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Contact, Skills, etc. */}
        <div class={styles().rightColumn}>
          {/* Contact/Personal Info Block */}
          <div class={styles().infoBlock}>
            <h3 class={styles().sectionHeading}>{resumeData.personal.name}</h3>
            <div class={styles().infoTitle}>{resumeData.personal.title}</div>

            <div class="mt-4">
              <div class={styles().contactInfo}>
                <span class={styles().icon}>📧</span>
                <span>{resumeData.personal.email}</span>
              </div>
              <div class={styles().contactInfo}>
                <span class={styles().icon}>📱</span>
                <span>{resumeData.personal.phone}</span>
              </div>
              <div class={styles().contactInfo}>
                <span class={styles().icon}>📍</span>
                <span>{resumeData.personal.location}</span>
              </div>
              <div class={styles().contactInfo}>
                <span class={styles().icon}>🌐</span>
                <span>{resumeData.personal.website}</span>
              </div>
            </div>

            <button class={styles().downloadButton}>
              Download Resume (PDF)
            </button>
          </div>

          {/* Skills Section */}
          <div class={styles().section}>
            <h3 class={styles().sectionHeading}>Skills</h3>
            <div class={styles().skillList}>
              {resumeData.skills.map((skill) => (
                <span class={styles().skill}>{skill}</span>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div class={styles().section}>
            <h3 class={styles().sectionHeading}>Languages</h3>
            <div class={styles().bulletPoints}>
              {resumeData.languages.map((language) => (
                <div class={styles().bulletPoint}>
                  <span class={styles().bullet}>•</span>
                  <span class={styles().bulletText}>{language}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div class={styles().section}>
            <h3 class={styles().sectionHeading}>Certifications</h3>
            <div class={styles().bulletPoints}>
              {resumeData.certifications.map((cert) => (
                <div class={styles().bulletPoint}>
                  <span class={styles().bullet}>•</span>
                  <span class={styles().bulletText}>{cert}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeSection;
