<!-- src/lib/components/Login.svelte -->
<script>
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { auth } from "../services/firebase";
  import { onMount } from "svelte";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;
  let showPassword = false;
  let mounted = false;
  let emailFocused = false;
  let passwordFocused = false;

  onMount(() => {
    mounted = true;
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
  <!-- Add Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />

  <style>
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
        transform: translateY(-20px) scale(1.02);
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

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.8;
      }
    }

    @keyframes typing {
      from {
        border-color: #3b82f6;
      }
      to {
        border-color: #60a5fa;
      }
    }

    .animate-fade-in-up {
      animation: fadeInUp 0.6s ease-out forwards;
    }

    .animate-fade-in {
      animation: fadeIn 0.8s ease-out forwards;
    }

    .animate-float {
      animation: float 6s ease-in-out infinite;
    }

    .animate-slide-in-left {
      animation: slideInLeft 0.8s ease-out forwards;
    }

    .animate-slide-in-right {
      animation: slideInRight 0.8s ease-out forwards;
    }

    .animate-shimmer {
      animation: shimmer 2s linear infinite;
      background: linear-gradient(
        90deg,
        rgba(59, 130, 246, 0.1) 0%,
        rgba(147, 197, 253, 0.3) 50%,
        rgba(59, 130, 246, 0.1) 100%
      );
      background-size: 1000px 100%;
    }

    .animate-typing {
      animation: typing 0.6s ease-in-out infinite alternate;
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

    * {
      font-family:
        "Inter",
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .input-typing {
      position: relative;
    }

    .input-typing::after {
      content: "";
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
      background-size: 200% 100%;
      animation: shimmer 1.5s linear infinite;
    }
  </style>
</svelte:head>

<div
  class="min-h-screen bg-linear-to-br from-blue-400 via-blue-600 to-blue-800 overflow-hidden"
>
  <div class="flex flex-col lg:flex-row min-h-screen">
    <!-- Left Side - Blue Gradient Section -->
    <div
      class="lg:w-1/2 relative overflow-hidden flex items-center justify-center p-8 lg:p-16"
    >
      <!-- Decorative circles -->
      <div
        class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"
      ></div>
      <div
        class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/30 rounded-full blur-3xl"
      ></div>
      <div
        class="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-2xl"
      ></div>

      <div class="relative z-10 text-center max-w-lg">
        <!-- Tagline -->
        <p
          class="text-blue-50 text-sm lg:text-base mb-8 lg:mb-12 {mounted
            ? 'animate-fade-in'
            : 'opacity-0'}"
        >
          Streamline your team's attendance – effortless tracking made simple.
        </p>

        <!-- Main heading -->
        <h1
          class="text-white text-4xl lg:text-6xl font-bold mb-8 lg:mb-16 leading-tight {mounted
            ? 'animate-slide-in-left delay-100'
            : 'opacity-0'}"
        >
          Track & Manage<br />Attendance
        </h1>

        <!-- Phone mockup -->
        <div class="{mounted ? 'animate-float delay-200' : 'opacity-0'} mt-8">
          <div class="relative inline-block">
            <!-- Glow effect behind phone -->
            <div
              class="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-110"
            ></div>
            <img
              src="/src/assets/phone.webp"
              alt="Fineer App"
              class="relative w-80 lg:w-md mx-auto drop-shadow-2xl"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - White Rounded Container -->
    <div class="lg:w-1/2 flex items-center justify-center p-4 lg:p-8">
      <div
        class="bg-white rounded-l-3xl lg:rounded-l-[3rem] shadow-2xl w-full h-full lg:h-auto flex items-center justify-center p-8 lg:p-16"
      >
        <div class="w-full max-w-md">
          <!-- Header -->
          <div class="mb-10 {mounted ? 'animate-slide-in-right' : 'opacity-0'}">
            <div class="mb-12">
              <img
                src="/src/assets/logo.webp"
                alt="Fineer Logo"
                class="h-16 lg:h-20"
              />
            </div>

            <h2 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              Sign In
            </h2>
            <p class="text-gray-500 text-sm">
              Access your attendance dashboard
            </p>
          </div>

          <!-- Form -->
          <form
            on:submit|preventDefault={handleSubmit}
            class="space-y-5 {mounted
              ? 'animate-fade-in-up delay-200'
              : 'opacity-0'}"
          >
            <!-- Error Message -->
            {#if error}
              <div
                class="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 animate-fade-in-up flex items-start gap-3"
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
                <span>{error}</span>
              </div>
            {/if}

            <!-- Email Input -->
            <div class="relative">
              <label for="email" class="sr-only">Email or Username</label>
              <div class={emailFocused ? "input-typing" : ""}>
                <input
                  type="email"
                  id="email"
                  bind:value={email}
                  on:focus={() => (emailFocused = true)}
                  on:blur={() => (emailFocused = false)}
                  placeholder="Email or Username"
                  required
                  disabled={loading}
                  class="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-0 focus:border-blue-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            <!-- Password Input -->
            <div class="relative">
              <label for="password" class="sr-only">Password</label>
              <div class={passwordFocused ? "input-typing" : ""}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  bind:value={password}
                  on:focus={() => (passwordFocused = true)}
                  on:blur={() => (passwordFocused = false)}
                  placeholder="Password"
                  required
                  disabled={loading}
                  class="w-full px-5 py-4 pr-12 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-0 focus:border-blue-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  on:click={() => (showPassword = !showPassword)}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-10"
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
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
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
            </div>

            <!-- Sign In Button -->
            <button
              type="submit"
              disabled={loading}
              class="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mt-8 relative overflow-hidden"
            >
              {#if loading}
                <div class="absolute inset-0 animate-shimmer"></div>
                <svg
                  class="animate-spin h-5 w-5 relative z-10"
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
                <span class="relative z-10">Signing in...</span>
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
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                Sign In
              {/if}
            </button>
          </form>

          <!-- Footer -->
          <div
            class="mt-10 text-center text-xs text-gray-500 {mounted
              ? 'animate-fade-in delay-400'
              : 'opacity-0'}"
          >
            <div class="flex items-center justify-between">
              <p>© 2005-2025 Fineer Inc.</p>
              <div class="flex items-center gap-4">
                <a
                  href="/contact"
                  class="hover:text-blue-600 transition-colors font-medium"
                  >Contact Us</a
                >
                <button
                  class="flex items-center gap-1 hover:text-blue-600 transition-colors font-medium"
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
