<script>
  import { writable } from "svelte/store";
  import { onMount } from "svelte";
  import EmployeeOverview from "./EmployeeOverview.svelte";
  import EmployeeForms from "./EmployeeForms.svelte";
  import { authStore } from "../../stores/auth";

  export let language = writable("en");

  const translations = {
    en: {
      dashboard: "Dashboard",
      forms: "Forms",
      mySubmissions: "My Submissions",
    },
    id: {
      dashboard: "Dasbor",
      forms: "Formulir",
      mySubmissions: "Pengajuan Saya",
    },
  };

  $: t = translations[$language];

  let activeTab = "dashboard";
  let mounted = false;

  onMount(() => {
    mounted = true;
    console.log("EmployeeDashboard mounted");
    console.log("Auth store:", $authStore);
    console.log("User data:", $authStore.userData);
  });

  $: console.log("Active tab:", activeTab);
  $: console.log("Language:", $language);

  function toggleLanguage() {
    language.update((lang) => (lang === "en" ? "id" : "en"));
  }
</script>

<svelte:head>
  <style>
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
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
    .animate-slide-in-up {
      animation: slideInUp 0.4s ease-out forwards;
    }
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
  </style>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
  <!-- Language Toggle -->
  <div class="flex justify-end {mounted ? 'animate-fade-in' : 'opacity-0'}">
    <button
      on:click={toggleLanguage}
      class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-all"
    >
      <svg
        class="w-5 h-5 text-gray-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span class="text-sm font-medium text-gray-700">
        {$language === "en" ? "English" : "Bahasa"}
      </span>
    </button>
  </div>

  <!-- Tab Content -->
  {#if activeTab === "dashboard"}
    <EmployeeOverview {language} />
  {:else if activeTab === "forms"}
    <EmployeeForms {language} tab="forms" />
  {:else if activeTab === "submissions"}
    <EmployeeForms {language} tab="submissions" />
  {/if}
</div>
