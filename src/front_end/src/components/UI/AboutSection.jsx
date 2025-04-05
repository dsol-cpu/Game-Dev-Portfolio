import { createSignal } from "solid-js";

const AboutSection = () => {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row gap-8 items-center">
        <div class="w-48 h-48 rounded-full overflow-hidden border-4 border-blue-200 flex-shrink-0">
          <img
            src="/assets/images/profile.jpg"
            alt="Developer Profile"
            class="w-full h-full object-cover"
            onError={(e) => {
              e.target.src =
                "https://via.placeholder.com/200x200?text=Game+Dev";
            }}
          />
        </div>

        <div class="flex-grow">
          <h3 class="text-2xl font-bold text-blue-800 mb-2">Jane Doe</h3>
          <p class="text-gray-600 mb-3">Game Developer & 3D Artist</p>

          <p class="text-gray-700">
            I'm a passionate game developer with 5 years of experience creating
            immersive digital worlds. My expertise spans full-stack development
            with a special focus on interactive 3D experiences and game
            mechanics that captivate players.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <p class="text-gray-700">
          With a background in computer science and a lifelong love for gaming,
          I blend technical expertise with creative vision to develop unique
          gaming experiences.
        </p>

        <div
          class={`overflow-hidden transition-all duration-500 ${expanded() ? "max-h-96" : "max-h-0"}`}
        >
          <div class="space-y-4 pt-4">
            <p class="text-gray-700">
              My journey in game development began with modding existing games,
              which taught me how to work within established frameworks while
              adding my unique creative touch. This experience proved invaluable
              as I moved into independent development, where I've created
              several award-winning indie games.
            </p>

            <p class="text-gray-700">
              I specialize in procedural generation, shader programming, and
              creating responsive game physics. When I'm not coding, I enjoy
              creating 3D models and experimenting with new game mechanics.
            </p>

            <p class="text-gray-700">
              My mission is to create games that not only entertain but also
              challenge players to think differently about the world around
              them.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded())}
          class="text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          {expanded() ? "Show Less" : "Read More"}
          <svg
            class={`ml-1 w-4 h-4 transition-transform ${expanded() ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        </button>
      </div>

      <div class="pt-4 border-t border-gray-200">
        <div class="flex flex-wrap gap-4">
          <a
            href="/resume.pdf"
            class="inline-flex items-center bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded"
            target="_blank"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            Download Resume
          </a>

          <a
            href="https://itch.io/yourusername"
            class="inline-flex items-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3.13 1.338C2.08 1.96.02 4.328 0 4.95v1.03c0 1.303 1.22 2.45 2.325 2.45 1.33 0 2.436-1.102 2.436-2.41 0 1.308 1.07 2.41 2.4 2.41 1.328 0 2.362-1.102 2.362-2.41 0 1.308 1.137 2.41 2.466 2.41h.024c1.33 0 2.466-1.102 2.466-2.41 0 1.308 1.034 2.41 2.363 2.41 1.33 0 2.4-1.102 2.4-2.41 0 1.308 1.106 2.41 2.435 2.41C22.78 8.43 24 7.282 24 5.98V4.95c-.02-.622-2.08-2.99-3.13-3.612-3.382-.023-5.226-.045-8.86-.045-3.634 0-5.477.022-8.86.045zM2.076 8.92c-.21 0-.358.024-.424.072-.65.03-.108.085-.13.165-.022.064-.044.196-.065.393-.043.59-.065 1.292-.065 2.1 0 .54.065 1.907.195 2.28.324.938 1.03 1.919 1.943 2.485v-1.877c0-1.368.043-2.445.13-3.233.064-.71.173-1.153.325-1.312.087-.09.195-.124.347-.124.173 0 .39.022.65.065a8.03 8.03 0 01.845.228c.173.065.412.131.714.218.28.09.532.155.757.209.022-.518.043-1.365.065-2.550-.237-.064-.563-.14-.975-.232-.412-.087-.845-.175-1.278-.26a9.22 9.22 0 00-1.04-.164c-.303-.022-.607-.033-.954-.033h-.065l.02-.021zM21.934 8.92c-.216 0-.41.023-.585.043-.173.023-.4.066-.672.11-.28.043-.607.12-.975.218a55.99 55.99 0 01-1.257.261c.022 1.186.043 2.033.065 2.55.228-.053.477-.12.758-.21.303-.086.54-.151.715-.217.238-.086.52-.173.845-.228.26-.043.477-.065.65-.065.152 0 .26.033.347.124.152.159.26.601.325 1.312.086.788.13 1.865.13 3.233v1.877c.912-.566 1.62-1.547 1.942-2.486.13-.372.195-1.74.195-2.279 0-.808-.022-1.51-.065-2.099-.02-.197-.043-.33-.065-.393-.022-.08-.065-.135-.13-.165-.065-.048-.216-.073-.424-.073h-.151c-.022 0-.043 0-.065.022h-.043c-.02-.022-.043-.022-.085-.022h-.455zM9.704 12.585a26.326 26.326 0 00-.519.032c-.216.022-.39.033-.52.033-.108 0-.238-.011-.367-.033-.13-.021-.26-.031-.39-.031-.064 0-.15.01-.26.031-.087.022-.195.033-.324.033-.129 0-.3-.011-.52-.033l-.518-.032c-.043 1.153-.065 2.38-.065 3.688 0 .85.13 1.483.39 1.888.218.356.498.534.845.534.39 0 .737-.178 1.04-.534.238-.28.39-.687.455-1.223.043-.372.065-1.335.065-2.878v-.438c0-.632-.022-1.208-.065-1.725-.043-.517-.086-.927-.13-1.223l-.108-.02.001-.001zm1.19.001c.044.296.087.706.13 1.223.044.537.066 1.112.066 1.725v.438c0 1.544.022 2.506.065 2.878.065.536.217.944.455 1.223.304.356.65.534 1.041.534.347 0 .628-.178.845-.534.26-.405.39-1.037.39-1.888 0-1.308-.022-2.535-.065-3.688-.217 0-.39.01-.518.032-.217.022-.39.033-.52.033-.13 0-.238-.011-.324-.033-.108-.021-.195-.03-.26-.031-.13 0-.26.01-.39.03-.13.023-.26.033-.368.033-.13 0-.304-.01-.52-.032a26.326 26.326 0 00-.518-.033h-.001z"></path>
            </svg>
            Itch.io Portfolio
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutSection;
