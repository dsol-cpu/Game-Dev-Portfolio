export default function MobileMenuButton(props) {
  const { isOpen, setIsOpen } = props;

  return (
    <button
      class="mobile-menu-toggle fixed top-4 left-4 z-50 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 p-2 text-white shadow-lg hover:from-blue-500 hover:to-teal-400"
      onClick={() => setIsOpen(!isOpen())}
      aria-label="Toggle menu"
    >
      <svg
        class="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {isOpen() ? (
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        ) : (
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        )}
      </svg>
    </button>
  );
}
