<script>
  import Sidebar from "./Sidebar.svelte";
  import Topbar from "./Topbar.svelte";
  import Overview from "./Overview.svelte";
  import Attendance from "./Attendance.svelte";
  import Employees from "./Employees.svelte";
  import Forms from "./Forms.svelte"; 
  import Reports from "./Reports.svelte";

  export let onLogout;

  let activeTab = "Dashboard";

  // Updated sidebarItems: Merged Izin Approvals and Cuti Approvals into 'Forms'
  const sidebarItems = [
    { name: "Dashboard", icon: "M10 20l4-16m4 4l4-4m-4 4l-4 4" },
    { name: "Attendance", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    {
      name: "Employees",
      icon: "M16 7A4 4 0 1112 3a4 4 0 014 4zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    },
    // Consolidated Forms tab
    {
      name: "Forms",
      icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    },
    { name: "Reports", icon: "M9 19V6l2-2 2 2v13M12 19V6l2-2 2 2v13" },
  ];

  // Function to map the sidebar name to the component
  $: CurrentComponent = (() => {
    switch (activeTab) {
      case "Dashboard":
        return Overview;
      case "Attendance":
        return Attendance;
      case "Employees":
        return Employees;
      case "Forms": // Map 'Forms' to the Forms component
        return Forms;
      case "Reports":
        return Reports;
      default:
        return Overview;
    }
  })();
</script>

<div class="flex h-screen bg-gray-50 overflow-hidden">
  <Sidebar {sidebarItems} bind:activeTab on:logout={onLogout} />

  <div class="flex-1 flex flex-col overflow-hidden">
    <Topbar title={activeTab} />

    <main
      class="flex-1 overflow-x-hidden overflow-y-auto p-6 transition duration-300"
    >
      <svelte:component this={CurrentComponent} />
    </main>
  </div>
</div>
