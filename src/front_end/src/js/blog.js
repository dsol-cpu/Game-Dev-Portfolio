import { blogPostsData } from "./data/blog";

/**
 * Create a blog post item
 */
function createBlogPost(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "blog-post";

  wrapper.innerHTML = `
  <div class="xp-window">
    <div class="xp-titlebar">
      <div class="xp-icon"></div>
      <div class="xp-title">${item.headline}.txt</div>
      <div class="xp-controls">
        <div class="xp-button minimize"></div>
        <div class="xp-button maximize"></div>
        <div class="xp-button close"></div>
      </div>
    </div>
    <div class="xp-content">
    <div class="blog-post-thumbnail">
      <img src="${item.thumbnail}" alt="${item.title}" />
    </div>
    <div class="blog-post-content">
      <h3 class="blog-post-title">${item.title}</h3>
      <div class="xp-sub-window">
      <p class="blog-post-description">${item.description}</p>
      <p class="blog-date"><i>${item.date}</i></p>
    </div>
    </div>
          <p class="blog-post-tags">${item.tags.join(", ")}</p>

    </div>
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
