import { createSignal } from "solid-js";

const ContactSection = () => {
  const [formData, setFormData] = createSignal({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [formStatus, setFormStatus] = createSignal({
    submitted: false,
    error: false,
    message: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData(), [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData().name || !formData().email || !formData().message) {
      setFormStatus({
        submitted: true,
        error: true,
        message: "Please fill out all required fields",
      });
      return;
    }

    setTimeout(() => {
      setFormStatus({
        submitted: true,
        error: false,
        message: "Thank you for your message! I'll get back to you soon.",
      });

      setFormData({
        name: "",
        email: "",
        subject: "",
        message: "",
      });

      setTimeout(() => {
        setFormStatus({
          submitted: false,
          error: false,
          message: "",
        });
      }, 5000);
    }, 1000);
  };

  return (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Contact Info */}
      <div class="space-y-6">
        {/* ...contact info code from original snippet... */}
      </div>

      {/* Contact Form */}
      <div>
        <h3 class="text-xl font-bold text-blue-900 mb-4">Send a Message</h3>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label
              class="block text-sm font-medium text-gray-700 mb-1"
              for="name"
            >
              Name *
            </label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData().name}
              onInput={handleChange}
              class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              class="block text-sm font-medium text-gray-700 mb-1"
              for="email"
            >
              Email *
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData().email}
              onInput={handleChange}
              class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              class="block text-sm font-medium text-gray-700 mb-1"
              for="subject"
            >
              Subject
            </label>
            <input
              type="text"
              name="subject"
              id="subject"
              value={formData().subject}
              onInput={handleChange}
              class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              class="block text-sm font-medium text-gray-700 mb-1"
              for="message"
            >
              Message *
            </label>
            <textarea
              name="message"
              id="message"
              value={formData().message}
              onInput={handleChange}
              rows="5"
              class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Send Message
          </button>

          {formStatus().submitted && (
            <p
              class={`mt-2 text-sm ${
                formStatus().error ? "text-red-600" : "text-green-600"
              }`}
            >
              {formStatus().message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ContactSection;
