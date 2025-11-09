<!-- src/lib/components/Employees.svelte -->
<script>
  import { onMount } from "svelte";
  import { collection, getDocs, query, where } from "firebase/firestore";
  import { db } from "../services/firebase";

  let employees = [];
  let sites = [];
  let selectedSite = "";
  let loading = true;

  onMount(() => {
    loadEmployees();
  });

  async function loadEmployees() {
    loading = true;
    try {
      let q;
      q = collection(db, "pegawai");
      if (selectedSite) {
        q = query(q, where("site", "==", selectedSite));
      }

      const snap = await getDocs(q);
      employees = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Extract unique sites
      const siteSet = new Set();
      snap.docs.forEach((doc) => {
        const site = doc.data().site;
        if (site) siteSet.add(site);
      });
      sites = Array.from(siteSet).sort();
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      loading = false;
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "Never";
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="bg-white rounded-xl shadow-sm border border-gray-100">
    <div class="p-6 border-b border-gray-100">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <h2 class="text-lg font-semibold text-gray-900">Employee List</h2>
        <div class="flex gap-2">
          <select
            bind:value={selectedSite}
            on:change={loadEmployees}
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Sites</option>
            {#each sites as site}
              <option value={site}>{site}</option>
            {/each}
          </select>
          <button
            on:click={loadEmployees}
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>

    <div class="p-6">
      {#if loading}
        <div class="flex flex-col items-center justify-center py-12">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"
          ></div>
          <p class="mt-4 text-gray-500">Loading employees...</p>
        </div>
      {:else if employees.length === 0}
        <div class="text-center py-12">
          <p class="text-gray-500">No employees found</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Name</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >NIK</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Email</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Job</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Site</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Role</th
                >
                <th
                  class="text-left py-3 px-4 text-sm font-semibold text-gray-700"
                  >Last Login</th
                >
              </tr>
            </thead>
            <tbody>
              {#each employees as employee}
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-3 px-4 font-medium text-gray-900"
                    >{employee.name}</td
                  >
                  <td class="py-3 px-4 text-gray-700">{employee.nik || "-"}</td>
                  <td class="py-3 px-4 text-gray-700">{employee.email}</td>
                  <td class="py-3 px-4 text-gray-700">{employee.job || "-"}</td>
                  <td class="py-3 px-4 text-gray-700">{employee.site || "-"}</td
                  >
                  <td class="py-3 px-4">
                    {#if employee.role === "admin"}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full"
                        >Admin</span
                      >
                    {:else}
                      <span
                        class="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full"
                        >Employee</span
                      >
                    {/if}
                  </td>
                  <td class="py-3 px-4 text-gray-700"
                    >{formatDate(employee.lastLogin)}</td
                  >
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
