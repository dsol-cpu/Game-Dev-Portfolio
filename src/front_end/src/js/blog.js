import fallback from "/images/you_can_do_it.jpeg";
import cupil from "/images/cupil.png";
const BlogTag = Object.freeze({
  GENERAL: "General",
  REAL: "Real",
});

// Blog post data
const blogPostsData = [
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

/**
 * Create a blog post item
 */
function createBlogPost(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "blog-post";

  wrapper.innerHTML = `
    <div class="blog-post-thumbnail">
      <img src="${item.thumbnail}" alt="${item.title}" />
    </div>
    <div class="blog-post-content">
      <h3 class="blog-post-title">${item.title}</h3>
      <p class="blog-post-tags">${item.tags.join(", ")}</p>
      <p class="blog-post-description">${item.description}</p>
    </div>
  `;
  return wrapper;
}

/**
 * Initialize blog posts
 */
function initBlogPosts() {
  const blogList = document.querySelector(".blog-list");
  if (!blogList) return;

  const fragment = document.createDocumentFragment();
  blogPostsData.forEach((item) => {
    fragment.appendChild(createBlogPost(item));
  });

  blogList.appendChild(fragment);
}

export { initBlogPosts };
