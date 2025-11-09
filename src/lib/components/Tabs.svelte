<script>
  import { authStore } from "../../stores/auth";

  export let activeTab = "overview";
  export let onTabChange = () => {};

  $: isAdmin = $authStore.userData?.role === "admin";

  const adminTabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "employees", label: "Employees", icon: "👥" },
    { id: "attendance", label: "Attendance", icon: "📋" },
    { id: "forms", label: "Forms", icon: "📝" },
    { id: "reports", label: "Reports", icon: "📄" },
  ];

  const employeeTabs = [
    { id: "overview", label: "Dashboard", icon: "🏠" },
    { id: "forms", label: "Submit Forms", icon: "📝" },
  ];

  $: tabs = isAdmin ? adminTabs : employeeTabs;
</script>

<div class="bg-white border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex space-x-1 overflow-x-auto py-2">
      {#each tabs as tab}
        <button
          on:click={() => onTabChange()}
          class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all {activeTab ===
          tab.id
            ? 'bg-blue-50 text-blue-600 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50'}"
        >
          <span class="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </div>
  </div>
</div>
