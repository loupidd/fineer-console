<!-- src/lib/components/ManagePegawai.svelte -->
<script>
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { db } from "../services/firebase";
  import {
    collection,
    query,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    Timestamp,
  } from "firebase/firestore";
  import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
  } from "firebase/auth";
  import { getFunctions, httpsCallable } from "firebase/functions";

  let employees = [];
  let loading = true;
  let showModal = false;
  let isEditMode = false;
  let selectedEmployee = null;
  let searchQuery = "";

  // Form data
  let formData = {
    name: "",
    nik: "",
    email: "",
    job: "",
    site: "",
    role: "pegawai",
  };

  const siteOptions = ["Essence Darmawangsa", "Nifarro Park"];
  const roleOptions = ["pegawai", "admin", "direktur"];
  const jobOptions = [
    "Field Engineer",
    "Supervisor",
    "Assistant Manager",
    "Admin Staff",
    "HRGA",
    "Director",
  ];

  onMount(() => {
    const q = query(collection(db, "pegawai"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      employees = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      loading = false;
    });

    return unsubscribe;
  });

  $: filteredEmployees = employees.filter((emp) => {
    const search = searchQuery.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(search) ||
      emp.nik?.toLowerCase().includes(search) ||
      emp.email?.toLowerCase().includes(search) ||
      emp.job?.toLowerCase().includes(search)
    );
  });

  function openAddModal() {
    isEditMode = false;
    selectedEmployee = null;
    formData = {
      name: "",
      nik: "",
      email: "",
      job: "",
      site: "",
      role: "pegawai",
    };
    showModal = true;
  }

  function openEditModal(employee) {
    isEditMode = true;
    selectedEmployee = employee;
    formData = {
      name: employee.name || "",
      nik: employee.nik || "",
      email: employee.email || "",
      job: employee.job || "",
      site: employee.site || "",
      role: employee.role || "pegawai",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedEmployee = null;
    formData = {
      name: "",
      nik: "",
      email: "",
      job: "",
      site: "",
      role: "pegawai",
    };
  }

  async function handleSubmit() {
    if (
      !formData.name ||
      !formData.nik ||
      !formData.email ||
      !formData.job ||
      !formData.site
    ) {
      alert("Semua field harus diisi!");
      return;
    }

    loading = true;
    try {
      if (isEditMode && selectedEmployee) {
        // Update existing employee
        await updateDoc(doc(db, "pegawai", selectedEmployee.uid), {
          name: formData.name,
          nik: formData.nik,
          email: formData.email,
          job: formData.job,
          site: formData.site,
          role: formData.role,
          updatedAt: Timestamp.now(),
        });
        alert("Data karyawan berhasil diperbarui!");
      } else {
        // Create new employee with Firebase Auth
        const auth = getAuth();

        // Store current admin credentials
        const adminEmail = $authStore.user.email;

        // Prompt for admin password to re-authenticate later
        const adminPassword = prompt(
          "Masukkan password admin Anda untuk validasi:"
        );
        if (!adminPassword) {
          alert("Password admin diperlukan untuk membuat karyawan baru");
          loading = false;
          return;
        }

        // Validate admin password first
        try {
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        } catch (error) {
          alert("Password admin salah!");
          loading = false;
          return;
        }

        // Create new user account with default password "password123"
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          "password123"
        );

        if (userCredential.user) {
          const uid = userCredential.user.uid;

          // Create employee document in Firestore
          await setDoc(doc(db, "pegawai", uid), {
            uid: uid,
            name: formData.name,
            nik: formData.nik,
            email: formData.email,
            job: formData.job,
            site: formData.site,
            role: formData.role,
            createdAt: Timestamp.now(),
            position: {
              lat: 0,
              long: 0,
            },
          });

          // Sign out the newly created user
          await auth.signOut();

          // Re-authenticate as admin
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

          alert(
            "Karyawan berhasil ditambahkan!\nEmail: " +
              formData.email +
              "\nPassword: password123"
          );
        }
      }
      closeModal();
    } catch (error) {
      console.error("Error saving employee:", error);
      if (error.code === "auth/wrong-password") {
        alert("Password admin salah!");
      } else if (error.code === "auth/email-already-in-use") {
        alert("Email sudah terdaftar!");
      } else {
        alert(`Gagal menyimpan data: ${error.message}`);
      }
    } finally {
      loading = false;
    }
  }

  async function handleDelete(employee) {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${employee.name}?`)) {
      return;
    }

    // Prompt for admin password
    const adminPassword = prompt(
      "Masukkan password admin Anda untuk konfirmasi:"
    );
    if (!adminPassword) {
      return;
    }

    loading = true;
    try {
      const auth = getAuth();
      const adminEmail = $authStore.user.email;

      // Verify admin password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (error) {
        alert("Password admin salah!");
        loading = false;
        return;
      }

      // Delete from Firestore
      await deleteDoc(doc(db, "pegawai", employee.uid));

      // Note: Deleting from Firebase Auth requires Firebase Admin SDK
      // which can only run on the server side for security reasons.
      // You have two options:
      // 1. Create a Cloud Function to delete the auth user
      // 2. Use Firebase Admin SDK on your backend

      alert(
        "Karyawan berhasil dihapus dari database!\n\nCATATAN: Akun autentikasi masih ada. Untuk menghapus sepenuhnya, gunakan Firebase Console atau buat Cloud Function."
      );
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Gagal menghapus karyawan: " + error.message);
    } finally {
      loading = false;
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return "-";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
</script>

<div class="min-h-screen bg-white px-4 sm:px-6 lg:px-8 py-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header Card -->
    <div
      class="bg-linear-to-r from-[#1A4786] to-[#3A7AE0] rounded-3xl shadow-lg p-8 mb-8"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <div class="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <svg
              class="w-10 h-10 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-white">Kelola Karyawan</h1>
            <p class="text-white/80 mt-1">Manajemen data karyawan perusahaan</p>
          </div>
        </div>
        <button
          on:click={openAddModal}
          class="px-6 py-3 bg-linear-to-r from-[#FFD700] to-[#FFA500] text-[#1A4786] font-bold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
        >
          + Tambah Karyawan
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="mb-6">
      <div class="relative">
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari karyawan (nama, NIK, email, jabatan)..."
          class="w-full px-5 py-4 pl-12 rounded-2xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none shadow-sm"
        />
        <svg
          class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>

    <!-- Employee Table -->
    <div class="bg-white shadow-lg rounded-2xl border border-gray-100">
      <div
        class="px-6 py-5 border-b border-gray-100 bg-linear-to-r from-[#F8F8F8] to-white rounded-t-2xl"
      >
        <h2 class="text-xl font-bold text-[#1A4786]">
          Daftar Karyawan ({filteredEmployees.length})
        </h2>
      </div>

      {#if loading}
        <div class="px-6 py-12 text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A7AE0] mx-auto"
          ></div>
          <p class="mt-4 text-gray-500">Memuat data...</p>
        </div>
      {:else if filteredEmployees.length === 0}
        <div class="px-6 py-12 text-center">
          <div class="bg-[#F8F8F8] rounded-2xl p-8 inline-block">
            <svg
              class="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p class="mt-4 text-gray-600 font-medium">
            {searchQuery
              ? "Tidak ada karyawan yang cocok"
              : "Belum ada data karyawan"}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-[#F8F8F8]">
              <tr>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Nama & NIK
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Email
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Jabatan
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Lokasi
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  class="px-6 py-4 text-left text-xs font-bold text-[#1A4786] uppercase tracking-wider"
                >
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              {#each filteredEmployees as employee (employee.uid)}
                <tr class="hover:bg-[#F8F8F8] transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-[#1A4786]">
                      {employee.name}
                    </div>
                    <div class="text-sm text-gray-500">{employee.nik}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {employee.email}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white shadow-sm"
                    >
                      {employee.job}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {employee.site}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      class="px-2 py-1 text-xs font-semibold rounded-lg {employee.role ===
                      'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : employee.role === 'direktur'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'}"
                    >
                      {employee.role}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      on:click={() => openEditModal(employee)}
                      class="px-3 py-1.5 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-semibold rounded-lg hover:shadow-md transition-all"
                    >
                      Edit
                    </button>
                    <button
                      on:click={() => handleDelete(employee)}
                      class="px-3 py-1.5 bg-linear-to-r from-[#EF4444] to-[#DC2626] text-white font-semibold rounded-lg hover:shadow-md transition-all"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add/Edit Modal -->
{#if showModal}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
  >
    <div
      class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    >
      <div
        class="px-6 py-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-linear-to-r from-[#1A4786] to-[#3A7AE0] rounded-t-3xl"
      >
        <h3 class="text-xl font-bold text-white">
          {isEditMode ? "Edit Karyawan" : "Tambah Karyawan Baru"}
        </h3>
        <button
          on:click={closeModal}
          class="text-white/80 hover:text-white transition-colors"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="px-6 py-6 space-y-5">
        <!-- Personal Information -->
        <div>
          <h4 class="font-bold text-[#1A4786] mb-4 text-lg">
            Informasi Personal
          </h4>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >Nama Lengkap</label
              >
              <input
                type="text"
                bind:value={formData.name}
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
                placeholder="Masukkan nama lengkap"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >NIK (ID Karyawan)</label
              >
              <input
                type="text"
                bind:value={formData.nik}
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
                placeholder="Masukkan NIK"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >Email</label
              >
              <input
                type="email"
                bind:value={formData.email}
                required
                disabled={isEditMode}
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none {isEditMode
                  ? 'bg-gray-100'
                  : ''}"
                placeholder="email@example.com"
              />
              {#if isEditMode}
                <p class="text-xs text-gray-500 mt-1">
                  Email tidak dapat diubah
                </p>
              {/if}
            </div>
          </div>
        </div>

        <!-- Job Information -->
        <div>
          <h4 class="font-bold text-[#1A4786] mb-4 text-lg">
            Informasi Pekerjaan
          </h4>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >Jabatan</label
              >
              <select
                bind:value={formData.job}
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
              >
                <option value="">Pilih Jabatan</option>
                {#each jobOptions as job}
                  <option value={job}>{job}</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >Lokasi Site</label
              >
              <select
                bind:value={formData.site}
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
              >
                <option value="">Pilih Lokasi</option>
                {#each siteOptions as site}
                  <option value={site}>{site}</option>
                {/each}
              </select>
            </div>

            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2"
                >Role</label
              >
              <select
                bind:value={formData.role}
                required
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
              >
                {#each roleOptions as role}
                  <option value={role}>{role}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            on:click={closeModal}
            class="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            class="px-6 py-3 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
          >
            {isEditMode ? "Perbarui" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
