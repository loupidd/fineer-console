<script>
  import { authStore } from "./stores/auth";
  import Login from "./lib/components/Login.svelte";
  import Topbar from "./lib/components/Topbar.svelte";
  import Overview from "./lib/components/Overview.svelte";
  import Employees from "./lib/components/Employees.svelte";
  import ManagePegawai from "./lib/components/ManagePegawai.svelte";
  import Attendance from "./lib/components/Attendance.svelte";
  import Reports from "./lib/components/Reports.svelte";
  import Forms from "./lib/components/Forms.svelte";
  import EmployeeDashboard from "./lib/components/EmployeeDashboard.svelte";
  import DirekturDashboard from "./lib/components/DirekturDashboard.svelte";
  import { language } from "./stores/language";

  let activeTab = "overview";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: isDirektur = $authStore.userData?.role === "direktur";
  $: isAuthenticated = $authStore.user && $authStore.userData;

  function handleTabChange(tab) {
    console.log("Switching to tab:", tab);
    activeTab = tab;
  }

  function handleLanguageChange(lang) {
    console.log("Switching to language:", lang);
    language.set(lang);
  }

  // Debug
  $: console.log("Current tab:", activeTab);
  $: console.log("Is admin:", isAdmin);
  $: console.log("Is direktur:", isDirektur);
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
    <Topbar {activeTab} onTabChange={handleTabChange} />

    <div class="pb-8">
      <!-- Overview Tab - Different dashboards based on role -->
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
      {#if activeTab === "employees" && isAdmin}
        <Employees />
      {/if}

      <!-- Manage Pegawai Tab - Admin only -->
      {#if activeTab === "managePegawai" && isAdmin}
        <ManagePegawai />
      {/if}

      <!-- Attendance Tab - Admin only -->
      {#if activeTab === "attendance" && isAdmin}
        <Attendance />
      {/if}

      <!-- Reports Tab - Admin only -->
      {#if activeTab === "reports" && isAdmin}
        <Reports />
      {/if}

      <!-- Forms Tab - All roles -->
      {#if activeTab === "forms"}
        <Forms />
      {/if}
    </div>
  {/if}
</main>
