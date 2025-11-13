<script>
  import { authStore } from "./stores/auth";
  import Login from "./lib/components/Login.svelte";
  import Topbar from "./lib/components/Topbar.svelte";
  import Overview from "./lib/components/Overview.svelte";
  import Employees from "./lib/components/Employees.svelte";
  import Reports from "./lib/components/Reports.svelte";
  import Forms from "./lib/components/Forms.svelte";
  import EmployeeDashboard from "./lib/components/EmployeeDashboard.svelte";
  import DirekturDashboard from "./lib/components/DirekturDashboard.svelte";
  import { language } from "./stores/language";
  import LandingPageCMS from "./lib/components/LandingPageCMS.svelte";

  let activeTab = "overview";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: isDirektur = $authStore.userData?.role === "direktur";
  $: isAuthenticated = $authStore.user && $authStore.userData;

  function handleTabChange(tab) {
    console.log("Switching to tab:", tab);
    activeTab = tab;
  }

  // Debug
  $: console.log("Current tab:", activeTab);
  $: console.log("Is admin:", isAdmin);
  $: console.log("Is direktur:", isDirektur);
</script>

<main class="min-h-screen bg-gray-50">
  {#if $authStore.loading}
    <div
      class="min-h-screen flex items-center justify-center bg-linear-to-br from-[#1A4786] via-[#2d5a9c] to-[#3A7AE0] overflow-hidden relative"
    >
      <!-- Floating orbs background -->
      <div class="absolute inset-0 overflow-hidden">
        <div
          class="absolute w-72 h-72 bg-white/5 rounded-full blur-3xl top-0 -left-20 animate-float"
          style="animation-duration: 20s;"
        ></div>
        <div
          class="absolute w-96 h-96 bg-white/5 rounded-full blur-3xl bottom-0 -right-20 animate-float"
          style="animation-duration: 25s; animation-delay: 2s;"
        ></div>
        <div
          class="absolute w-64 h-64 bg-[#FFD700]/10 rounded-full blur-2xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse"
          style="animation-duration: 4s;"
        ></div>
      </div>

      <!-- Main content -->
      <div class="relative z-10 text-center px-6">
        <!-- Logo/Icon -->
        <div class="mb-8 flex justify-center">
          <div class="relative w-24 h-24">
            <!-- Outer rotating ring -->
            <div
              class="absolute inset-0 border-4 border-white/20 rounded-full animate-spin-slow"
            ></div>

            <!-- Middle rotating ring -->
            <div
              class="absolute inset-2 border-4 border-t-white border-r-white border-b-transparent border-l-transparent rounded-full animate-spin"
              style="animation-duration: 1.5s;"
            ></div>

            <!-- Inner pulsing circle -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div
                class="w-12 h-12 bg-linear-to-br from-[#FFD700] to-[#FFA500] rounded-full animate-pulse shadow-lg shadow-[#FFD700]/50"
              ></div>
            </div>

            <!-- Orbiting dots -->
            <div
              class="absolute inset-0 animate-spin"
              style="animation-duration: 3s;"
            >
              <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
              ></div>
            </div>
            <div
              class="absolute inset-0 animate-spin-reverse"
              style="animation-duration: 2s;"
            >
              <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#FFD700] rounded-full shadow-lg"
              ></div>
            </div>
          </div>
        </div>

        <!-- Title -->
        <h1
          class="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight"
        >
          Loading
        </h1>

        <!-- Subtitle -->
        <p class="text-white/70 text-lg mb-8 font-medium">
          Preparing your experience
        </p>

        <!-- Progress bar -->
        <div class="w-80 max-w-full mx-auto mb-6">
          <div
            class="h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm"
          >
            <div
              class="h-full bg-linear-to-r from-[#FFD700] via-white to-[#FFD700] rounded-full animate-loading-bar"
            ></div>
          </div>
        </div>

        <!-- Loading dots -->
        <div class="flex justify-center items-center gap-2">
          <div
            class="w-2 h-2 bg-white rounded-full animate-bounce"
            style="animation-delay: 0s; animation-duration: 1.4s;"
          ></div>
          <div
            class="w-2 h-2 bg-white rounded-full animate-bounce"
            style="animation-delay: 0.2s; animation-duration: 1.4s;"
          ></div>
          <div
            class="w-2 h-2 bg-white rounded-full animate-bounce"
            style="animation-delay: 0.4s; animation-duration: 1.4s;"
          ></div>
        </div>
      </div>
    </div>
  {:else if !isAuthenticated}
    <Login />
  {:else}
    <Topbar {activeTab} onTabChange={handleTabChange} />

    <div class="pb-8">
      <!-- Overview Tab - Different dashboards based on role -->
      <!-- Keep components mounted, just hide them to prevent re-fetching data -->
      <div class:hidden={activeTab !== "overview"}>
        {#if isAdmin}
          <Overview />
        {:else if isDirektur}
          <DirekturDashboard />
        {:else}
          <EmployeeDashboard />
        {/if}
      </div>

      <!-- Employees Tab - Admin only -->
      <!-- Mount once and keep hidden instead of conditional rendering -->
      {#if isAdmin}
        <div class:hidden={activeTab !== "employees"}>
          <Employees />
        </div>
      {/if}

      <!-- Reports Tab - Admin only -->
      {#if isAdmin}
        <div class:hidden={activeTab !== "reports"}>
          <Reports />
        </div>
      {/if}

      <!-- Forms Tab - All roles -->
      <div class:hidden={activeTab !== "forms"}>
        <Forms />
      </div>

      <!-- Landing CMS Tab - Admin only -->
      {#if isAdmin}
        <div class:hidden={activeTab !== "landingCMS"}>
          <LandingPageCMS />
        </div>
      {/if}
    </div>
  {/if}
</main>

<style>
  .hidden {
    display: none;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0px) translateX(0px);
    }
    33% {
      transform: translateY(-30px) translateX(20px);
    }
    66% {
      transform: translateY(20px) translateX(-20px);
    }
  }

  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes spin-reverse {
    from {
      transform: rotate(360deg);
    }
    to {
      transform: rotate(0deg);
    }
  }

  @keyframes loading-bar {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  .animate-float {
    animation: float 20s ease-in-out infinite;
  }

  .animate-spin-slow {
    animation: spin-slow 8s linear infinite;
  }

  .animate-spin-reverse {
    animation: spin-reverse 3s linear infinite;
  }

  .animate-loading-bar {
    animation: loading-bar 2s ease-in-out infinite;
  }
</style>
