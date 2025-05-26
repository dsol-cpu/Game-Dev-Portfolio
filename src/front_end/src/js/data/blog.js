import fallback from "/images/you_can_do_it.jpeg";
import cupil from "/images/cupil.png";
import me from "/images/me.png";
const BlogTag = Object.freeze({
  GENERAL: "General",
  REAL: "Real",
});

// Blog post data
export const blogPostsData = [
  {
    date: "05/26/2025",
    tags: [BlogTag.GENERAL],
    title: "I am Lorem",
    description:
      "Of the ipsumums.  Of all the love and the glory and the heaven and the forever and yeah and um and so um yeah thanks for coming to my um hmmmm i forgor skull emoji.",
    thumbnail: cupil,
  },
  {
    date: "05/26/2025",
    tags: [BlogTag.REAL],
    title: "Chiikawa Motivational Poster",
    description: "You can do it.",
    thumbnail: fallback,
  },

  {
    tags: [BlogTag.REAL],
    date: "05/26/2025",
    title: "Mini Code for a Cause Game Jam - My Experience",
    description:
      "I joined a game jam and had a great time!  I used this experience to learn more about working with Unreal Engine. I learned how much we could improve ",
    thumbnail: fallback,
  },
];
