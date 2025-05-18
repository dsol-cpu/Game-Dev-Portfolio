import { blogPostsData } from "./data/blog";

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
