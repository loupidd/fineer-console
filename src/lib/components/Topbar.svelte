<!-- src/lib/components/Topbar.svelte -->
<script>
  import { signOut } from "firebase/auth";
  import { auth } from "../services/firebase";
  import { authStore } from "../../stores/auth";

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
</script>

<div class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <!-- Left Side -->
      <div class="flex items-center space-x-3">
        <div
          class="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md"
        >
          F
        </div>
        <div class="text-lg font-semibold text-gray-900">Fineer Admin</div>
      </div>

      <!-- Right Side -->
      <div class="flex items-center space-x-4">
        {#if $authStore.userData}
          <div class="text-right hidden sm:block">
            <div class="text-sm font-medium text-gray-900">
              {$authStore.userData.name}
            </div>
            <div class="text-xs text-gray-500 capitalize">
              {$authStore.userData.role}
            </div>
          </div>
        {/if}

        <button
          on:click={handleLogout}
          disabled={loading}
          class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Logging out..." : "Logout"}
        </button>
      </div>
    </div>
  </div>
</div>
