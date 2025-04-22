const BlogTag = Object.freeze({
  GENERAL: "general",
});
// Blog post data
const blogPostsData = [
  {
    tags: [BlogTag.GENERAL],
    title: "Lorem",
    description: "Of the ipsumums",
    thumbnail: "",
  },
  {
    tags: [BlogTag.GENERAL],
    title: "Interactive Dashboard",
    description: "A dashboard showing dynamic financial data.",
    thumbnail: "",
  },
];

/**
 * Create a blog post item
 */
function createBlogPost(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "blog-post";
  wrapper.setAttribute("data-category", item.category);
  wrapper.setAttribute("data-model", item.modelName || "");

  wrapper.innerHTML = `
      <div class="blog-post-info">
        <h3 class="blog-post-title">${item.title}</h3>
        <p class="blog-post-category">${item.tags.join(", ")}</p>
        <p class="blog-post-desc">${item.description}</p>
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
