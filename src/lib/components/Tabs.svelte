<script>
  import { authStore } from "../../stores/auth";

  export let activeTab = "overview";
  export let onTabChange = (tabId) => {};
  export let language = "en";

  const translations = {
    en: {
      overview: "Overview",
      dashboard: "Dashboard",
      employees: "Employees",
      attendance: "Attendance",
      forms: "Forms",
      submitForms: "Submit Forms",
      reports: "Reports",
    },
    id: {
      overview: "Ringkasan",
      dashboard: "Dashboard",
      employees: "Karyawan",
      attendance: "Kehadiran",
      forms: "Formulir",
      submitForms: "Kirim Formulir",
      reports: "Laporan",
    },
  };

  $: t = translations[language];
  $: isAdmin = $authStore.userData?.role === "admin";

  const adminTabs = [
    { id: "overview", label: "overview", icon: "chart" },
    { id: "employees", label: "employees", icon: "users" },
    { id: "attendance", label: "attendance", icon: "clipboard" },
    { id: "forms", label: "forms", icon: "document" },
    { id: "reports", label: "reports", icon: "file" },
  ];

  const employeeTabs = [
    { id: "overview", label: "dashboard", icon: "home" },
    { id: "forms", label: "submitForms", icon: "document" },
  ];

  $: tabs = isAdmin ? adminTabs : employeeTabs;

  const icons = {
    chart: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>`,
    users: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>`,
    clipboard: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>`,
    document: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>`,
    file: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>`,
    home: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>`,
  };
</script>

<div class="bg-white border-b border-gray-100 shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <nav
      class="flex space-x-2 overflow-x-auto py-3 scrollbar-hide"
      aria-label="Tabs"
    >
      {#each tabs as tab}
        <button
          on:click={() => onTabChange(tab.id)}
          class="group relative px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-300 flex items-center gap-2 {activeTab ===
          tab.id
            ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-lg shadow-[#3A7AE0]/30'
            : 'text-gray-600 hover:bg-[#F8F8F8] hover:text-[#1A4786]'}"
        >
          <!-- Icon -->
          <span
            class="transition-transform duration-300 {activeTab === tab.id
              ? 'scale-110'
              : 'group-hover:scale-110'}"
          >
            {@html icons[tab.icon]}
          </span>

          <!-- Label -->
          <span>{t[tab.label]}</span>

          <!-- Active indicator glow -->
          {#if activeTab === tab.id}
            <span
              class="absolute inset-0 rounded-xl bg-linear-to-r from-[#FFD700]/20 to-transparent opacity-50 pointer-events-none"
            ></span>
          {/if}

          <!-- Hover indicator -->
          {#if activeTab !== tab.id}
            <span
              class="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] transition-all duration-300 group-hover:w-3/4 rounded-full"
            ></span>
          {/if}
        </button>
      {/each}
    </nav>
  </div>
</div>

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
