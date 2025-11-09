<script>
  import "./app.css";

  import { authStore } from "./stores/auth";
  import Login from "./lib/components/Login.svelte";
  import Topbar from "./lib/components/Topbar.svelte";
  import Tabs from "./lib/components/Tabs.svelte";
  import Overview from "./lib/components/Overview.svelte";
  import Employees from "./lib/components/Employees.svelte";
  import Attendance from "./lib/components/Attendance.svelte";
  import Reports from "./lib/components/Reports.svelte";
  import Forms from "./lib/components/Forms.svelte";
  import EmployeeDashboard from "./lib/components/EmployeeDashboard.svelte";

  let activeTab = "overview";

  $: isAdmin = $authStore.userData?.role === "admin";
  $: isAuthenticated = $authStore.user && $authStore.userData;

  function handleTabChange(tab) {
    activeTab = tab;
  }
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
  {:else if isAuthenticated && $authStore.userData.role !== "admin" && $authStore.userData.role !== "pegawai"}
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-lg p-8 max-w-md">
        <div class="text-center">
          <div class="text-6xl mb-4">⚠️</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p class="text-gray-600 mb-6">
            You don't have permission to access this application.
          </p>
          <button
            on:click={() => authStore.signOut()}
            class="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  {:else}
    <Topbar />
    <Tabs {activeTab} onTabChange={handleTabChange} />

    <div class="pb-8">
      {#if activeTab === "overview"}
        {#if isAdmin}
          <Overview />
        {:else}
          <EmployeeDashboard />
        {/if}
      {:else if activeTab === "employees" && isAdmin}
        <Employees />
      {:else if activeTab === "attendance" && isAdmin}
        <Attendance />
      {:else if activeTab === "reports" && isAdmin}
        <Reports />
      {:else if activeTab === "forms"}
        <Forms />
      {/if}
    </div>
  {/if}
</main>
