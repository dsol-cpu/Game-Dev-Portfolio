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
    tags: [BlogTag.GENERAL],
    title: "I am Lorem",
    description:
      "Of the ipsumums.  Of all the love and the glory and the heaven and the forever and yeah and um and so um yeah thanks for coming to my um hmmmm i forgor skull emoji.",
    thumbnail: cupil,
  },
  {
    tags: [BlogTag.REAL],
    title: "Chiikawa Motivational Poster",
    description: "You can do it.",
    thumbnail: fallback,
  },
];
