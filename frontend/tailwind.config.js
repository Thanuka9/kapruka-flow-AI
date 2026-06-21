/** @type {import('tailwindcss').Config} */

module.exports = {

  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],

  theme: {

    extend: {

      colors: {

        kapruka: {

          red: "#D80000",

          "red-dark": "#B50000",

          gold: "#F6C343",

          "gold-hover": "#FFD86B",

        },

        flow: {

          bg: "var(--color-bg)",

          "bg-secondary": "var(--color-bg-secondary)",

          card: "var(--color-card)",

          border: "var(--color-border)",

          text: "var(--color-text-primary)",

          muted: "var(--color-text-muted)",

          secondary: "var(--color-text-secondary)",

        },

        semantic: {

          success: "#16A34A",

          warning: "#F59E0B",

          error: "#EF4444",

          info: "#3B82F6",

        },

      },

      fontFamily: {

        sans: ["Inter", "system-ui", "sans-serif"],

      },

      maxWidth: {

        flow: "1280px",

      },

      borderRadius: {

        card: "16px",

        pill: "999px",

      },

      boxShadow: {

        card: "0 10px 40px rgba(10,20,40,.08)",

        "card-hover": "0 16px 48px rgba(10,20,40,.12)",

      },

      spacing: {

        section: "48px",

        grid: "32px",

      },

      keyframes: {

        fadeIn: {

          from: { opacity: "0", transform: "translateY(8px)" },

          to: { opacity: "1", transform: "translateY(0)" },

        },

      },

      animation: {

        fadeIn: "fadeIn 0.45s ease-out forwards",

      },

    },

  },

  plugins: [],

};

