<script>
  import { writable } from "svelte/store";
  import { onMount } from "svelte";
  import EmployeeOverview from "./EmployeeOverview.svelte";
  import { translations } from "../i18n/translations";

  import { authStore } from "../../stores/auth";

  export let language = writable("en");

  $: t = translations[$language].EmployeeDashboard;

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
  <!-- Tab Content -->
  <EmployeeOverview />
</div>
