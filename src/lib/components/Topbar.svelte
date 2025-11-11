<script>
  import { signOut } from "firebase/auth";
  import { auth } from "../services/firebase";
  import { authStore } from "../../stores/auth";
  import logo from "../../assets/logo.webp";
  import { translations } from "../i18n/translations";
  import { language } from "../../stores/language";

  export let activeTab = "overview";
  export let onTabChange = (tabId) => {};

  $: t = translations[$language].Topbar;

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

  let loading = false;

  async function handleLogout() {
    loading = true;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      loading = false;
    }
  }

  function switchLanguage(lang) {
    language.set(lang);
  }
</script>

<div class="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
  <!-- Top Bar -->
  <div class="border-b border-gray-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- Left Side - Logo -->
        <div class="flex items-center space-x-3">
          <div
            class="w-10 h-10 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] rounded-xl flex items-center justify-center text-white font-bold shadow-md relative overflow-hidden group"
          >
            <div
              class="absolute inset-0 bg-linear-to-br from-[#FFD700]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
            ></div>
            <span class="relative z-10 text-lg"><img src={logo} alt="" /></span>
          </div>
          <div>
            <div
              class="text-lg font-bold bg-linear-to-r from-[#1A4786] to-[#3A7AE0] bg-clip-text text-transparent"
            >
              Fineer Console
            </div>
          </div>
        </div>

        <!-- Right Side - User Info & Actions -->
        <div class="flex items-center gap-3">
          <!-- Language Switch -->
          <button
            on:click={() => switchLanguage("en")}
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200
    {$language === 'en'
              ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-sm'
              : 'text-gray-600 hover:text-[#1A4786]'}"
          >
            EN
          </button>

          <button
            on:click={() => switchLanguage("id")}
            class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200
    {$language === 'id'
              ? 'bg-linear-to-r from-[#1A4786] to-[#3A7AE0] text-white shadow-sm'
              : 'text-gray-600 hover:text-[#1A4786]'}"
          >
            ID
          </button>

          <!-- User Info -->
          {#if $authStore.userData}
            <div
              class="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#F8F8F8] rounded-xl"
            >
              <div
                class="w-8 h-8 bg-linear-to-br from-[#1A4786] to-[#3A7AE0] rounded-lg flex items-center justify-center text-white text-sm font-bold"
              >
                {$authStore.userData.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold text-[#1A4786]">
                  {$authStore.userData.name}
                </div>
                <div class="text-xs text-gray-600 capitalize">
                  {$authStore.userData.role}
                </div>
              </div>
            </div>
          {/if}

          <!-- Logout Button -->
          <button
            on:click={handleLogout}
            disabled={loading}
            class="px-4 py-2 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if loading}
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
            {:else}
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            {/if}
            <span class="hidden sm:inline"
              >{loading ? t.loggingOut : t.logout}</span
            >
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation Tabs -->
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
