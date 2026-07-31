/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EDF4FA", 100: "#D9E8F5", 200: "#B3D1EB", 300: "#84B4DC",
          500: "#0F4C81", 600: "#0D4270", 700: "#0B385F", 800: "#082E4E", 900: "#06233C",
        },
        saffron: {
          DEFAULT: "#F4A100", 50: "#FEF6E5", 100: "#FDEBC8", 400: "#F9B02E",
          500: "#F4A100", 600: "#D98F00", 700: "#B57600",
        },
        leaf: { DEFAULT: "#1E8E5A", 50: "#E9F7F0", 100: "#D2EEDD", 600: "#177A4C", 700: "#12653E" },
        danger: { DEFAULT: "#D64545", 50: "#FBEBEB", 600: "#B93737" },
        ink: "#1C1C1E",
        mist: "#F7F9FC",
      },
      fontFamily: {
        display: ["Poppins", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.06)",
        lift: "0 12px 32px rgba(15,76,129,0.16)",
        card: "0 2px 10px rgba(15,76,129,0.08)",
      },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
      },
      animation: { floaty: "floaty 5s ease-in-out infinite" },
    },
  },
  plugins: [],
};
