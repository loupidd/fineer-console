<!-- src/App.svelte -->
<script>
  import { authStore } from "./stores/auth";
  import Login from "./lib/components/Login.svelte";
  import Topbar from "./lib/components/Topbar.svelte";
  import Overview from "./lib/components/Overview.svelte";
  import Employees from "./lib/components/Employees.svelte";
  import Attendance from "./lib/components/Attendance.svelte";
  import Reports from "./lib/components/Reports.svelte";
  import Forms from "./lib/components/Forms.svelte";
  import EmployeeDashboard from "./lib/components/EmployeeDashboard.svelte";

  let activeTab = "overview";
  let language = "en";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: isAuthenticated = $authStore.user && $authStore.userData;

  function handleTabChange(tab) {
    console.log("Switching to tab:", tab);
    activeTab = tab;
  }

  function handleLanguageChange(lang) {
    console.log("Switching to language:", lang);
    language = lang;
  }

  // Debug
  $: console.log("Current tab:", activeTab);
  $: console.log("Is admin:", isAdmin);
</script>

<main class="min-h-screen bg-gray-50">
  {#if $authStore.loading}
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"
        ></div>
        <p class="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  {:else if !isAuthenticated}
    <Login />
  {:else}
    <Topbar
      {activeTab}
      onTabChange={handleTabChange}
      {language}
      onLanguageChange={handleLanguageChange}
    />

    <div class="pb-8">
      <!-- Overview Tab - Always render but hide when not active -->
      <div class:hidden={activeTab !== "overview"}>
        {#if isAdmin}
          <Overview />
        {:else}
          <EmployeeDashboard />
        {/if}
      </div>

      <!-- Employees Tab -->
      {#if activeTab === "employees" && isAdmin}
        <Employees />
      {/if}

      <!-- Attendance Tab -->
      {#if activeTab === "attendance" && isAdmin}
        <Attendance />
      {/if}

      <!-- Reports Tab -->
      {#if activeTab === "reports" && isAdmin}
        <Reports />
      {/if}

      <!-- Forms Tab -->
      {#if activeTab === "forms"}
        <Forms />
      {/if}
    </div>
  {/if}
</main>
