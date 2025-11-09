<!-- src/lib/components/Login.svelte -->
<script>
  import { signInWithEmailAndPassword } from "firebase/auth";
  import { auth } from "../services/firebase";

  let email = "";
  let password = "";
  let error = "";
  let loading = false;

  async function handleSubmit() {
    error = "";
    loading = true;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Reset form on success
      email = "";
      password = "";
    } catch (err) {
      error = err.message || "Failed to sign in";
    } finally {
      loading = false;
    }
  }
</script>

<div
  class="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4"
>
  <div class="w-full max-w-md">
    <div class="bg-white rounded-2xl shadow-xl p-8 space-y-6">
      <!-- Logo and Header -->
      <div class="text-center space-y-2">
        <div
          class="w-16 h-16 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl mx-auto flex items-center justify-center text-white text-2xl font-bold shadow-lg"
        >
          F
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p class="text-gray-500">Sign in to manage attendance</p>
      </div>

      <!-- Error Message -->
      {#if error}
        <div
          class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"
        >
          {error}
        </div>
      {/if}

      <!-- Login Form -->
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label
            for="email"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            bind:value={email}
            placeholder="admin@fineer.com"
            required
            disabled={loading}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            bind:value={password}
            placeholder="Enter your password"
            required
            disabled={loading}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          class="w-full bg-linear-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  </div>
</div>
