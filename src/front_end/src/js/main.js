/**
 * Main JavaScript for portfolio site
 * Handles navigation, portfolio filtering, form submission,
 * and other UI interactions
 */

let portfolioItemCount = 0;
let activeProjectCardCamBitMask = 0;

let filterButtons;
let portfolioItems;
document.addEventListener("DOMContentLoaded", function () {
  // Set up navigation
  initNavigation();

  // Set up portfolio filtering
  initPortfolioFilters();

  // Set up contact form
  initContactForm();
});

/**
 * Initialize navigation functionality
 */
function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("section");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      // Remove active classes
      navLinks.forEach((link) => link.classList.remove("active"));
      sections.forEach((section) => section.classList.remove("active"));

      // Set active link
      this.classList.add("active");

      // Activate the target section
      const targetId = this.getAttribute("data-target");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");

        // Scroll to it (optional)
        // if (window.innerWidth <= 768) {
        //   targetSection.scrollIntoView({ behavior: "smooth" });
        // }
      }
    });
  });
}

/**
 * Initialize portfolio filtering
 */
function initPortfolioFilters() {
  filterButtons = document.querySelectorAll(".filter-button");
  portfolioItems = document.querySelectorAll(".portfolio-item");

  portfolioItemCount = portfolioItems.length;
  activeProjectCardCamBitMask = new Uint8Array(portfolioItemCount);

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Remove active class from all filter buttons
      filterButtons.forEach((btn) => btn.classList.remove("active"));

      // Add active class to clicked button
      this.classList.add("active");

      const filter = this.getAttribute("data-filter");

      // Show all items if filter is 'all'
      if (filter === "all") {
        portfolioItems.forEach((item) => {
          item.style.display = "block";
        });
      } else {
        // Show items that match the filter
        portfolioItems.forEach((item) => {
          const categories = item.getAttribute("data-category");
          if (categories.includes(filter)) {
            item.style.display = "block";
          } else {
            item.style.display = "none";
          }
        });
      }
    });
  });
}

/**
 * Initialize contact form
 */
function initContactForm() {
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Basic form validation
      const nameInput = document.getElementById("name");
      const emailInput = document.getElementById("email");
      const messageInput = document.getElementById("message");

      if (
        nameInput.value.trim() === "" ||
        emailInput.value.trim() === "" ||
        messageInput.value.trim() === ""
      ) {
        alert("Please fill out all fields.");
        return;
      }

      // In a real implementation, you would send data to a server here
      // For this demo, just show a success message
      alert(
        "Thanks for your message! This is a demo form, so no message was actually sent."
      );
      contactForm.reset();
    });
  }
}

function createBitmask(indices) {
  let bitmask = 0;
  for (let index = 0; index < indices.length; index++) {
    bitmask |= 1 << index;
  }
  return bitmask;
}
