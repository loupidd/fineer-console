<!-- src/lib/components/Login.svelte -->
<script>
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { auth } from "../services/firebase";
  import { onMount } from "svelte";
  import logo from "../../assets/logo.webp";
  import phone from "../../assets/phone.webp";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;
  let showPassword = false;
  let mounted = false;
  let emailFocused = false;
  let passwordFocused = false;
  let mouseX = 0;
  let mouseY = 0;
  let particles = [];

  onMount(() => {
    mounted = true;

    // Create floating particles
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        delay: Math.random() * 5,
      });
    }
    particles = particles;

    // Mouse tracking for parallax
    const handleMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 20;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 20;
    };
    window.addEventListener("mousemove", handleMouseMove);

    return () => window.removeEventListener("mousemove", handleMouseMove);
  });

  async function handleSubmit() {
    error = "";
    loading = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      email = "";
      password = "";
    } catch (err) {
      error = err.message || "Failed to sign in";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
    rel="stylesheet"
  />

  <style>
    .mesh-gradient,
    .particle,
    .animate-gradient,
    .animate-float-gentle {
      pointer-events: none;
    }
    form,
    input,
    button,
    label,
    .gradient-border {
      pointer-events: auto;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes float {
      0%,
      100% {
        transform: translateY(0px) scale(1);
      }
      50% {
        transform: translateY(-30px) scale(1.03);
      }
    }

    @keyframes floatGentle {
      0%,
      100% {
        transform: translate(0, 0);
      }
      33% {
        transform: translate(10px, -10px);
      }
      66% {
        transform: translate(-10px, 10px);
      }
    }

    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(50px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    @keyframes shimmerGold {
      0% {
        background-position: -200% center;
      }
      100% {
        background-position: 200% center;
      }
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.8;
        transform: scale(1.05);
      }
    }

    @keyframes glow {
      0%,
      100% {
        filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.4));
      }
      50% {
        filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.7));
      }
    }

    @keyframes rotate {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes scaleIn {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes ripple {
      0% {
        box-shadow:
          0 0 0 0 rgba(58, 122, 224, 0.4),
          0 0 0 10px rgba(58, 122, 224, 0.3),
          0 0 0 20px rgba(58, 122, 224, 0.2);
      }
      100% {
        box-shadow:
          0 0 0 10px rgba(58, 122, 224, 0.3),
          0 0 0 20px rgba(58, 122, 224, 0.2),
          0 0 0 40px rgba(58, 122, 224, 0);
      }
    }

    @keyframes gradientShift {
      0%,
      100% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
    }

    .animate-fade-in-up {
      animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .animate-fade-in {
      animation: fadeIn 1s ease-out forwards;
    }

    .animate-float {
      animation: float 8s ease-in-out infinite;
    }

    .animate-float-gentle {
      animation: floatGentle 20s ease-in-out infinite;
    }

    .animate-slide-in-left {
      animation: slideInLeft 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .animate-slide-in-right {
      animation: slideInRight 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .animate-shimmer {
      animation: shimmer 3s linear infinite;
      background: linear-gradient(
        90deg,
        rgba(58, 122, 224, 0.1) 0%,
        rgba(58, 122, 224, 0.4) 50%,
        rgba(58, 122, 224, 0.1) 100%
      );
      background-size: 200% 100%;
    }

    .animate-shimmer-gold {
      animation: shimmerGold 3s linear infinite;
    }

    .animate-glow {
      animation: glow 3s ease-in-out infinite;
    }

    .animate-pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    .animate-rotate {
      animation: rotate 20s linear infinite;
    }

    .animate-scale-in {
      animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .animate-ripple {
      animation: ripple 2s ease-out infinite;
    }

    .animate-gradient {
      animation: gradientShift 8s ease infinite;
      background-size: 200% 200%;
    }

    .delay-100 {
      animation-delay: 0.1s;
    }
    .delay-200 {
      animation-delay: 0.2s;
    }
    .delay-300 {
      animation-delay: 0.3s;
    }
    .delay-400 {
      animation-delay: 0.4s;
    }
    .delay-500 {
      animation-delay: 0.5s;
    }
    .delay-600 {
      animation-delay: 0.6s;
    }

    * {
      font-family:
        "Inter",
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .gradient-border {
      position: relative;
      background: white;
      border-radius: 0.75rem;
    }

    .gradient-border::before {
      content: "";
      position: absolute;
      inset: -2px;
      border-radius: 0.75rem;
      padding: 2px;
      background: linear-gradient(135deg, #3a7ae0, #ffd700, #3a7ae0);
      -webkit-mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .gradient-border.active::before {
      opacity: 1;
    }

    .glass-morphism {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .text-gradient {
      background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(255, 215, 0, 0.8),
        rgba(255, 215, 0, 0)
      );
      pointer-events: none;
    }

    .mesh-gradient {
      background: radial-gradient(
          at 20% 30%,
          rgba(26, 71, 134, 0.8) 0px,
          transparent 50%
        ),
        radial-gradient(
          at 80% 70%,
          rgba(58, 122, 224, 0.8) 0px,
          transparent 50%
        ),
        radial-gradient(at 50% 50%, rgba(26, 71, 134, 0.6) 0px, transparent 50%);
      pointer-events: none;
    }

    .particle {
      pointer-events: none;
    }
    form,
    input,
    button,
    label,
    .gradient-border,
    .z-10,
    .z-20,
    .z-30 {
      position: relative;
      z-index: 50;
      pointer-events: auto !important;
    }
    .mesh-gradient,
    .particle,
    .animate-gradient,
    .animate-float-gentle {
      pointer-events: none !important;
      z-index: 0 !important;
    }
  </style>
</svelte:head>

<div
  class="min-h-screen bg-linear-to-br from-[#1A4786] via-[#2563A8] to-[#3A7AE0] overflow-hidden relative"
>
  <!-- Animated mesh background -->
  <div class="absolute inset-0 mesh-gradient animate-gradient opacity-50"></div>

  <!-- Floating particles -->
  {#each particles as particle, i}
    <div
      class="particle animate-float-gentle"
      style="
        left: {particle.x}%;
        top: {particle.y}%;
        width: {particle.size}px;
        height: {particle.size}px;
        animation-delay: {particle.delay}s;
        animation-duration: {15 + Math.random() * 10}s;
      "
    ></div>
  {/each}

  <div class="flex flex-col lg:flex-row min-h-screen relative z-10">
    <!-- Left Side - Enhanced Gradient Section -->
    <div
      class="lg:w-1/2 relative overflow-hidden flex items-center justify-center p-8 lg:p-16"
    >
      <!-- Animated background elements -->
      <div
        class="absolute top-1/4 left-1/4 w-96 h-96 bg-[#3A7AE0]/30 rounded-full blur-3xl animate-pulse"
        style="animation-duration: 4s;"
      ></div>
      <div
        class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#1A4786]/40 rounded-full blur-3xl animate-pulse"
        style="animation-duration: 6s; animation-delay: 1s;"
      ></div>
      <div
        class="absolute top-1/2 left-1/2 w-64 h-64 bg-[#FFD700]/20 rounded-full blur-2xl animate-pulse"
        style="animation-duration: 5s; animation-delay: 2s;"
      ></div>

      <!-- Rotating ring -->
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-[600px] h-[600px] rounded-full border-2 border-[#FFD700]/20 animate-rotate"
          style="animation-duration: 30s;"
        ></div>
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-[500px] h-[500px] rounded-full border border-[#3A7AE0]/30 animate-rotate"
          style="animation-duration: 40s; animation-direction: reverse;"
        ></div>
      </div>

      <div
        class="relative z-10 text-center max-w-lg"
        style="transform: translate({mouseX * 0.5}px, {mouseY *
          0.5}px); transition: transform 0.3s ease-out;"
      >
        <!-- Tagline with shimmer effect -->
        <div class="relative inline-block">
          <p
            class="text-white/90 text-sm lg:text-base mb-8 lg:mb-12 font-medium {mounted
              ? 'animate-fade-in'
              : 'opacity-0'}"
          >
            Streamline your team's attendance –
            <span class="text-gradient font-bold">effortless tracking</span> made
            simple.
          </p>
        </div>

        <!-- Main heading with enhanced styling -->
        <h1
          class="relative text-white text-5xl lg:text-7xl font-black mb-8 lg:mb-16 leading-tight {mounted
            ? 'animate-slide-in-left delay-100'
            : 'opacity-0'}"
        >
          <span class="relative inline-block">
            Track & Manage
            <div
              class="absolute -bottom-2 left-0 w-full h-1 bg-linear-to-r from-transparent via-[#FFD700] to-transparent animate-shimmer-gold"
            ></div>
          </span>
          <br />
          <span class="text-gradient animate-glow">Attendance</span>
        </h1>

        <!-- Enhanced phone mockup -->
        <div class="{mounted ? 'animate-float delay-200' : 'opacity-0'} mt-8">
          <div class="relative inline-block">
            <!-- Multiple glow layers -->
            <div
              class="absolute inset-0 bg-[#FFD700]/30 blur-3xl rounded-full scale-110 animate-pulse"
              style="animation-duration: 3s;"
            ></div>
            <div
              class="absolute inset-0 bg-[#3A7AE0]/40 blur-2xl rounded-full scale-105 animate-pulse"
              style="animation-duration: 4s; animation-delay: 0.5s;"
            ></div>

            <!-- Decorative corner accents -->
            <div
              class="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-[#FFD700] rounded-tl-2xl opacity-60"
            ></div>
            <div
              class="absolute -bottom-4 -right-4 w-20 h-20 border-b-4 border-r-4 border-[#FFD700] rounded-br-2xl opacity-60"
            ></div>

            <img
              src={phone}
              alt="Fineer App"
              class="relative w-80 lg:w-96 mx-auto drop-shadow-2xl transform transition-transform hover:scale-105"
              style="filter: drop-shadow(0 20px 60px rgba(255, 215, 0, 0.3));"
            />
          </div>
        </div>

        <!-- Feature pills -->
        <div
          class="flex flex-wrap gap-3 justify-center mt-12 {mounted
            ? 'animate-fade-in delay-400'
            : 'opacity-0'}"
        >
          {#each ["Real-time Tracking", "Smart Analytics", "Team Insights"] as feature, i}
            <div
              class="glass-morphism px-4 py-2 rounded-full text-white text-xs font-semibold animate-scale-in"
              style="animation-delay: {0.5 + i * 0.1}s;"
            >
              ✨ {feature}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right Side - Enhanced White Container -->
    <div class="lg:w-1/2 flex items-center justify-center p-4 lg:p-8 relative">
      <!-- Decorative gradient orb -->
      <div
        class="absolute top-20 right-20 w-40 h-40 bg-linear-to-br from-[#FFD700]/20 to-[#3A7AE0]/20 rounded-full blur-3xl animate-pulse"
      ></div>

      <div
        class="bg-white rounded-3xl lg:rounded-l-[4rem] shadow-2xl w-full h-full lg:h-auto flex items-center justify-center p-8 lg:p-16 relative overflow-hidden"
      >
        <!-- Corner decorations -->
        <div
          class="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-[#3A7AE0]/5 to-transparent rounded-bl-full"
        ></div>
        <div
          class="absolute bottom-0 left-0 w-32 h-32 bg-linear-to-tr from-[#FFD700]/5 to-transparent rounded-tr-full"
        ></div>

        <div class="w-full max-w-md relative z-10">
          <!-- Header -->
          <div class="mb-10 {mounted ? 'animate-slide-in-right' : 'opacity-0'}">
            <div class="mb-12 relative">
              <img
                src={logo}
                alt="Fineer Logo"
                class="h-16 lg:h-20 animate-scale-in"
              />
              <div
                class="absolute -bottom-3 left-0 w-24 h-1 bg-linear-to-r from-[#3A7AE0] to-[#6ca0f5] rounded-full"
              ></div>
            </div>

            <h2
              class="text-4xl lg:text-5xl font-black text-[#1A4786] mb-3 tracking-tight"
            >
              Sign In
            </h2>
            <p class="text-gray-500 text-base font-medium">
              Access your
              <span class="text-[#3A7AE0] font-semibold"
                >attendance dashboard</span
              >
            </p>
          </div>

          <!-- Form -->
          <form
            on:submit|preventDefault={handleSubmit}
            class="space-y-6 relative z-10 {mounted
              ? 'animate-fade-in-up delay-200'
              : 'opacity-0'}"
          >
            <!-- Error Message -->
            {#if error}
              <div
                class="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-sm text-red-600 animate-scale-in flex items-start gap-3 shadow-lg"
              >
                <svg
                  class="w-5 h-5 shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span class="font-medium">{error}</span>
              </div>
            {/if}

            <!-- Email Input -->
            <div class="relative group">
              <label
                for="email"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                Email or Username
              </label>
              <div class="gradient-border {emailFocused ? 'active' : ''}">
                <input
                  type="email"
                  id="email"
                  bind:value={email}
                  on:focus={() => (emailFocused = true)}
                  on:blur={() => (emailFocused = false)}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                  class="w-full px-5 py-4 bg-[#F8F8F8] border border-transparent rounded-xl focus:outline-none focus:border-[#3A7AE0] focus:bg-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400 font-medium"
                />
              </div>
              {#if emailFocused}
                <div
                  class="absolute left-0 right-0 bottom-0 h-0.5 bg-linear-to-r from-[#3A7AE0] to-[#3A7AE0] animate-shimmer-gold"
                  style="background-size: 200% 100%;"
                ></div>
              {/if}
            </div>

            <!-- Password Input -->
            <div class="relative group mb-4 pb-3">
              <label
                for="password"
                class="block text-sm font-semibold text-[#1A4786] mb-2"
              >
                Password
              </label>

              <div class="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  bind:value={password}
                  on:focus={() => (passwordFocused = true)}
                  on:blur={() => (passwordFocused = false)}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  class="w-full px-5 py-4 pr-12 bg-[#F8F8F8] rounded-xl focus:outline-none focus:ring-0 focus:bg-white border-none text-gray-900 placeholder-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                />

                <!-- Toggle password visibility -->
                <button
                  type="button"
                  on:click={() => (showPassword = !showPassword)}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#3A7AE0] transition-all hover:scale-110"
                  aria-label="Toggle password visibility"
                >
                  {#if showPassword}
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  {:else}
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  {/if}
                </button>
              </div>

              <!-- Animated shimmer bottom border -->
              {#if passwordFocused}
                <div
                  class="absolute left-0 right-0 bottom-0 h-0.5 bg-linear-to-r from-[#3A7AE0] via-[#4BA3F9] to-[#3A7AE0] animate-[shimmer_2s_linear_infinite]"
                  style="background-size: 200% 100%;"
                ></div>
              {/if}
            </div>

            <!-- Sign In Button -->
            <button
              type="submit"
              disabled={loading}
              class="w-full bg-linear-to-r from-[#3A7AE0] to-[#1A4786] hover:from-[#1A4786] hover:to-[#3A7AE0] text-white py-5 rounded-2xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] flex items-center justify-center gap-3 mt-8 relative overflow-hidden group"
            >
              {#if !loading}
                <div
                  class="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                ></div>
              {/if}

              {#if loading}
                <div class="absolute inset-0 animate-shimmer"></div>
                <svg
                  class="animate-spin h-6 w-6 relative z-10"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span class="relative z-10 font-bold">Signing in...</span>
              {:else}
                <svg
                  class="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span class="relative z-10 font-bold">Sign In</span>
                <div
                  class="absolute -right-12 top-1/2 -translate-y-1/2 w-24 h-24 bg-[#FFD700]/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"
                ></div>
              {/if}
            </button>
          </form>

          <!-- Footer -->
          <div
            class="mt-12 text-center text-sm text-gray-500 {mounted
              ? 'animate-fade-in delay-400'
              : 'opacity-0'}"
          >
            <div class="flex items-center justify-between">
              <p class="font-medium">
                © 2005-2025 <span class="text-[#3A7AE0] font-semibold"
                  >Fineer Inc.</span
                >
              </p>
              <div class="flex items-center gap-4">
                <a
                  href="/contact"
                  class="hover:text-[#3A7AE0] transition-colors font-semibold hover:scale-110 transform inline-block"
                >
                  Contact Us
                </a>
                <button
                  class="flex items-center gap-1 hover:text-[#3A7AE0] transition-colors font-semibold hover:scale-110 transform"
                >
                  English
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
