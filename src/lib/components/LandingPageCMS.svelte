<script>
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { language } from "../../stores/language";
  import { db } from "../services/firebase";
  import {
    collection,
    query,
    getDocs,
    doc,
    orderBy,
    setDoc,
    updateDoc,
    deleteDoc,
    Timestamp,
  } from "firebase/firestore";
  import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
  } from "firebase/storage";

  // Translations
  const translations = {
    en: {
      header: {
        title: "Landing Page CMS",
        subtitle: "Manage service cards and content",
        addButton: "+ Add New Card",
      },
      loading: "Loading cards...",
      noCards: "No cards yet. Create your first card!",
      card: {
        moveUp: "Move up",
        moveDown: "Move down",
        edit: "Edit",
        delete: "Delete",
      },
      modal: {
        addTitle: "Add New Card",
        editTitle: "Edit Card",
        imageSection: "Card Images",
        addImage: "Add Image",
        cropImage: "Crop & Save",
        cancelCrop: "Cancel",
        removeImage: "Remove",
        setAsPrimary: "Set as Primary",
        primary: "Primary",
        title: "Title",
        titlePlaceholder: "e.g., Preventive Maintenance",
        description: "Description",
        descPlaceholder: "Brief description of the service...",
        modalContent: "Modal Content (Optional)",
        badge: "Badge Text",
        badgePlaceholder: "e.g., 🔧 MAINTENANCE SERVICE",
        features: "Features (up to 3)",
        featurePlaceholder: "Feature",
        cancel: "Cancel",
        create: "Create",
        update: "Update",
      },
      messages: {
        titleRequired: "Title and description are required!",
        imageRequired: "Please upload at least one image!",
        deleteConfirm: "Are you sure you want to delete",
        cardCreated: "Card created successfully!",
        cardUpdated: "Card updated successfully!",
        cardDeleted: "Card deleted successfully!",
        moveFailed: "Failed to move card",
        deleteFailed: "Failed to delete card",
        saveFailed: "Failed to save card",
      },
    },
    id: {
      header: {
        title: "CMS Halaman Landing",
        subtitle: "Kelola kartu layanan dan konten",
        addButton: "+ Tambah Kartu Baru",
      },
      loading: "Memuat kartu...",
      noCards: "Belum ada kartu. Buat kartu pertama Anda!",
      card: {
        moveUp: "Pindah ke atas",
        moveDown: "Pindah ke bawah",
        edit: "Edit",
        delete: "Hapus",
      },
      modal: {
        addTitle: "Tambah Kartu Baru",
        editTitle: "Edit Kartu",
        imageSection: "Gambar Kartu",
        addImage: "Tambah Gambar",
        cropImage: "Potong & Simpan",
        cancelCrop: "Batal",
        removeImage: "Hapus",
        setAsPrimary: "Jadikan Utama",
        primary: "Utama",
        title: "Judul",
        titlePlaceholder: "mis., Pemeliharaan Preventif",
        description: "Deskripsi",
        descPlaceholder: "Deskripsi singkat layanan...",
        modalContent: "Konten Modal (Opsional)",
        badge: "Teks Badge",
        badgePlaceholder: "mis., 🔧 LAYANAN PEMELIHARAAN",
        features: "Fitur (maksimal 3)",
        featurePlaceholder: "Fitur",
        cancel: "Batal",
        create: "Buat",
        update: "Perbarui",
      },
      messages: {
        titleRequired: "Judul dan deskripsi wajib diisi!",
        imageRequired: "Mohon unggah minimal satu gambar!",
        deleteConfirm: "Apakah Anda yakin ingin menghapus",
        cardCreated: "Kartu berhasil dibuat!",
        cardUpdated: "Kartu berhasil diperbarui!",
        cardDeleted: "Kartu berhasil dihapus!",
        moveFailed: "Gagal memindahkan kartu",
        deleteFailed: "Gagal menghapus kartu",
        saveFailed: "Gagal menyimpan kartu",
      },
    },
  };

  $: t = translations[$language];

  let cards = [];
  let loading = true;
  let showModal = false;
  let isEditMode = false;
  let selectedCard = null;

  // --- State variables ---
  let images = [];
  let primaryImageIndex = 0;
  let pendingImage = null;
  let showCropper = false;

  /** @type {HTMLCanvasElement | null} */
  let cropperCanvas = null;
  let cropperCtx = null;
  let cropArea = { x: 50, y: 50, width: 400, height: 500 };
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let isResizing = false;
  let resizeHandle = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let imageScale = 1;
  let originalImage = null;

  // Form data
  let formData = {
    title: "",
    description: "",
    images: [],
    modalContent: {
      badge: "",
      features: ["", "", ""],
    },
    order: 0,
  };

  const storage = getStorage();
  let refreshTrigger = 0;

  onMount(() => {
    loadCards();
  });

  async function loadCards() {
    loading = true;
    try {
      const q = query(collection(db, "landingPageCards"), orderBy("order"));
      const snapshot = await getDocs(q);

      cards = snapshot.docs
        .map((doc) => {
          /** @type {any} */
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        })
        .sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    isEditMode = false;
    selectedCard = null;
    images = [];
    primaryImageIndex = 0;
    formData = {
      title: "",
      description: "",
      images: [],
      modalContent: {
        badge: "",
        features: ["", "", ""],
      },
      order: cards.length,
    };
    showModal = true;
  }

  function openEditModal(card) {
    isEditMode = true;
    selectedCard = card;

    // Support both old single image and new multi-image format
    if (card.images && Array.isArray(card.images)) {
      images = card.images.map((url) => ({ url, uploaded: true }));
    } else if (card.imageUrl) {
      images = [{ url: card.imageUrl, uploaded: true }];
    } else {
      images = [];
    }

    primaryImageIndex = 0;
    formData = {
      title: card.title || "",
      description: card.description || "",
      images: images.map((img) => img.url),
      modalContent: {
        badge: card.modalContent?.badge || "",
        features: card.modalContent?.features || ["", "", ""],
      },
      order: card.order || 0,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedCard = null;
    images = [];
    primaryImageIndex = 0;
    pendingImage = null;
    showCropper = false;
    formData = {
      title: "",
      description: "",
      images: [],
      modalContent: {
        badge: "",
        features: ["", "", ""],
      },
      order: 0,
    };
  }

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingImage = {
          dataUrl: e.target.result,
          file: file,
        };
        showCropper = true;
        setTimeout(() => initCropper(), 100);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = "";
  }

  // Handle positions for resizing (8 handles around the crop area)
  const HANDLE_SIZE = 12;
  const HANDLES = [
    { name: "nw", cursor: "nw-resize" },
    { name: "n", cursor: "n-resize" },
    { name: "ne", cursor: "ne-resize" },
    { name: "e", cursor: "e-resize" },
    { name: "se", cursor: "se-resize" },
    { name: "s", cursor: "s-resize" },
    { name: "sw", cursor: "sw-resize" },
    { name: "w", cursor: "w-resize" },
  ];

  function initCropper() {
    const canvas = document.getElementById("cropperCanvas");
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
      console.error("Canvas not found or not a canvas element");
      return;
    }

    cropperCanvas = canvas;
    cropperCtx = cropperCanvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      originalImage = img;

      // Set canvas to display the full image at a reasonable size
      const maxWidth = 700;
      const maxHeight = 500;
      let displayWidth = img.width;
      let displayHeight = img.height;

      // Scale down if needed while maintaining aspect ratio
      const scale = Math.min(
        maxWidth / displayWidth,
        maxHeight / displayHeight,
        1
      );
      displayWidth = displayWidth * scale;
      displayHeight = displayHeight * scale;

      cropperCanvas.width = displayWidth;
      cropperCanvas.height = displayHeight;

      // Store the scale factor
      imageScale = scale;

      cropperCtx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Initialize crop area (4:5 aspect ratio) - centered on the image
      const targetRatio = 4 / 5;
      let cropWidth, cropHeight;

      // Make crop area 60% of the smaller dimension
      if (displayWidth / displayHeight > targetRatio) {
        cropHeight = displayHeight * 0.6;
        cropWidth = cropHeight * targetRatio;
      } else {
        cropWidth = displayWidth * 0.6;
        cropHeight = cropWidth / targetRatio;
      }

      cropArea = {
        x: (displayWidth - cropWidth) / 2,
        y: (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      };

      drawCropOverlay();
    };

    img.src = pendingImage?.dataUrl;
  }

  function drawCropOverlay() {
    if (!cropperCanvas || !cropperCtx || !originalImage) return;

    // Clear and redraw the image
    cropperCtx.clearRect(0, 0, cropperCanvas.width, cropperCanvas.height);
    cropperCtx.drawImage(
      originalImage,
      0,
      0,
      cropperCanvas.width,
      cropperCanvas.height
    );

    // Draw darkened overlay outside crop area
    cropperCtx.fillStyle = "rgba(0, 0, 0, 0.5)";

    // Top
    cropperCtx.fillRect(0, 0, cropperCanvas.width, cropArea.y);
    // Bottom
    cropperCtx.fillRect(
      0,
      cropArea.y + cropArea.height,
      cropperCanvas.width,
      cropperCanvas.height - cropArea.y - cropArea.height
    );
    // Left
    cropperCtx.fillRect(0, cropArea.y, cropArea.x, cropArea.height);
    // Right
    cropperCtx.fillRect(
      cropArea.x + cropArea.width,
      cropArea.y,
      cropperCanvas.width - cropArea.x - cropArea.width,
      cropArea.height
    );

    // Draw crop area border
    cropperCtx.strokeStyle = "#3A7AE0";
    cropperCtx.lineWidth = 2;
    cropperCtx.strokeRect(
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height
    );

    // Draw resize handles
    cropperCtx.fillStyle = "#3A7AE0";
    cropperCtx.strokeStyle = "#ffffff";
    cropperCtx.lineWidth = 2;

    const handles = getHandlePositions();
    handles.forEach((handle) => {
      cropperCtx.fillRect(
        handle.x - HANDLE_SIZE / 2,
        handle.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      );
      cropperCtx.strokeRect(
        handle.x - HANDLE_SIZE / 2,
        handle.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      );
    });

    // Draw grid lines (rule of thirds)
    cropperCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    cropperCtx.lineWidth = 1;

    // Vertical lines
    cropperCtx.beginPath();
    cropperCtx.moveTo(cropArea.x + cropArea.width / 3, cropArea.y);
    cropperCtx.lineTo(
      cropArea.x + cropArea.width / 3,
      cropArea.y + cropArea.height
    );
    cropperCtx.moveTo(cropArea.x + (cropArea.width * 2) / 3, cropArea.y);
    cropperCtx.lineTo(
      cropArea.x + (cropArea.width * 2) / 3,
      cropArea.y + cropArea.height
    );

    // Horizontal lines
    cropperCtx.moveTo(cropArea.x, cropArea.y + cropArea.height / 3);
    cropperCtx.lineTo(
      cropArea.x + cropArea.width,
      cropArea.y + cropArea.height / 3
    );
    cropperCtx.moveTo(cropArea.x, cropArea.y + (cropArea.height * 2) / 3);
    cropperCtx.lineTo(
      cropArea.x + cropArea.width,
      cropArea.y + (cropArea.height * 2) / 3
    );
    cropperCtx.stroke();
  }

  function getHandlePositions() {
    return [
      { name: "nw", x: cropArea.x, y: cropArea.y },
      { name: "n", x: cropArea.x + cropArea.width / 2, y: cropArea.y },
      { name: "ne", x: cropArea.x + cropArea.width, y: cropArea.y },
      {
        name: "e",
        x: cropArea.x + cropArea.width,
        y: cropArea.y + cropArea.height / 2,
      },
      {
        name: "se",
        x: cropArea.x + cropArea.width,
        y: cropArea.y + cropArea.height,
      },
      {
        name: "s",
        x: cropArea.x + cropArea.width / 2,
        y: cropArea.y + cropArea.height,
      },
      { name: "sw", x: cropArea.x, y: cropArea.y + cropArea.height },
      { name: "w", x: cropArea.x, y: cropArea.y + cropArea.height / 2 },
    ];
  }

  function getHandleAtPosition(x, y) {
    const handles = getHandlePositions();
    for (const handle of handles) {
      const distance = Math.sqrt(
        Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2)
      );
      if (distance <= HANDLE_SIZE) {
        return handle.name;
      }
    }
    return null;
  }

  function isInsideCropArea(x, y) {
    return (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.width &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.height
    );
  }

  function handleCanvasMouseDown(e) {
    if (!cropperCanvas) return;

    const rect = cropperCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on a resize handle
    const handle = getHandleAtPosition(x, y);
    if (handle) {
      isResizing = true;
      resizeHandle = handle;
      dragStartX = x;
      dragStartY = y;
      return;
    }

    // Check if clicking inside crop area (for dragging)
    if (isInsideCropArea(x, y)) {
      isDragging = true;
      dragStartX = x - cropArea.x;
      dragStartY = y - cropArea.y;
    }
  }

  function handleCanvasMouseMove(e) {
    if (!cropperCanvas) return;

    const rect = cropperCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update cursor based on position
    if (!isDragging && !isResizing) {
      const handle = getHandleAtPosition(x, y);
      if (handle) {
        const handleInfo = HANDLES.find((h) => h.name === handle);
        cropperCanvas.style.cursor = handleInfo.cursor;
      } else if (isInsideCropArea(x, y)) {
        cropperCanvas.style.cursor = "move";
      } else {
        cropperCanvas.style.cursor = "default";
      }
    }

    if (isResizing) {
      resizeCropArea(x, y);
      drawCropOverlay();
    } else if (isDragging) {
      // Move crop area
      let newX = x - dragStartX;
      let newY = y - dragStartY;

      // Keep crop area within canvas bounds
      newX = Math.max(0, Math.min(newX, cropperCanvas.width - cropArea.width));
      newY = Math.max(
        0,
        Math.min(newY, cropperCanvas.height - cropArea.height)
      );

      cropArea.x = newX;
      cropArea.y = newY;

      drawCropOverlay();
    }
  }
  function resizeCropArea(mouseX, mouseY) {
    const minSize = 50;
    const aspectRatio = 4 / 5; // width / height

    let newX = cropArea.x;
    let newY = cropArea.y;
    let newWidth = cropArea.width;
    let newHeight = cropArea.height;

    // Calculate new dimensions based on handle
    switch (resizeHandle) {
      case "nw":
        newWidth = cropArea.x + cropArea.width - mouseX;
        newHeight = newWidth / aspectRatio;
        newX = mouseX;
        newY = cropArea.y + cropArea.height - newHeight;
        break;
      case "n":
        newHeight = cropArea.y + cropArea.height - mouseY;
        newWidth = newHeight * aspectRatio;
        newX = cropArea.x + (cropArea.width - newWidth) / 2;
        newY = mouseY;
        break;
      case "ne":
        newWidth = mouseX - cropArea.x;
        newHeight = newWidth / aspectRatio;
        newY = cropArea.y + cropArea.height - newHeight;
        break;
      case "e":
        newWidth = mouseX - cropArea.x;
        newHeight = newWidth / aspectRatio;
        newY = cropArea.y + (cropArea.height - newHeight) / 2;
        break;
      case "se":
        newWidth = mouseX - cropArea.x;
        newHeight = newWidth / aspectRatio;
        break;
      case "s":
        newHeight = mouseY - cropArea.y;
        newWidth = newHeight * aspectRatio;
        newX = cropArea.x + (cropArea.width - newWidth) / 2;
        break;
      case "sw":
        newWidth = cropArea.x + cropArea.width - mouseX;
        newHeight = newWidth / aspectRatio;
        newX = mouseX;
        break;
      case "w":
        newWidth = cropArea.x + cropArea.width - mouseX;
        newHeight = newWidth / aspectRatio;
        newX = mouseX;
        newY = cropArea.y + (cropArea.height - newHeight) / 2;
        break;
    }

    // Ensure minimum size
    if (newWidth >= minSize && newHeight >= minSize) {
      // Keep within canvas bounds
      if (
        newX >= 0 &&
        newX + newWidth <= cropperCanvas.width &&
        newY >= 0 &&
        newY + newHeight <= cropperCanvas.height
      ) {
        cropArea.x = newX;
        cropArea.y = newY;
        cropArea.width = newWidth;
        cropArea.height = newHeight;
      }
    }
  }

  function handleCanvasMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    if (cropperCanvas) {
      cropperCanvas.style.cursor = "default";
    }
  }

  async function saveCroppedImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = pendingImage.dataUrl;
    });

    const scaleX = img.width / cropperCanvas.width;
    const scaleY = img.height / cropperCanvas.height;

    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      400,
      500
    );

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    images = [
      ...images,
      { url: croppedDataUrl, uploaded: false, file: pendingImage.file },
    ];

    showCropper = false;
    pendingImage = null;
  }

  function cancelCrop() {
    showCropper = false;
    pendingImage = null;
  }

  function removeImage(index) {
    images = images.filter((_, i) => i !== index);
    if (primaryImageIndex >= images.length) {
      primaryImageIndex = Math.max(0, images.length - 1);
    }
  }

  function setPrimaryImage(index) {
    primaryImageIndex = index;
  }

  async function uploadImage(imageData) {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const storageRef = ref(storage, `landing-cards/${fileName}`);

    // Convert data URL to blob
    const response = await fetch(imageData.url);
    const blob = await response.blob();

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  }

  async function handleSubmit() {
    if (!formData.title || !formData.description) {
      alert(t.messages.titleRequired);
      return;
    }

    if (images.length === 0) {
      alert(t.messages.imageRequired);
      return;
    }

    loading = true;
    try {
      // Upload new images
      const uploadedImages = await Promise.all(
        images.map(async (img) => {
          if (img.uploaded) {
            return img.url; // Already uploaded
          } else {
            return await uploadImage(img); // Upload new
          }
        })
      );

      // Reorder so primary image is first
      const reorderedImages = [
        uploadedImages[primaryImageIndex],
        ...uploadedImages.filter((_, i) => i !== primaryImageIndex),
      ];

      const cardData = {
        title: formData.title,
        description: formData.description,
        images: reorderedImages,
        imageUrl: reorderedImages[0], // Backward compatibility
        modalContent: {
          badge: formData.modalContent.badge,
          features: formData.modalContent.features.filter(
            (f) => f.trim() !== ""
          ),
        },
        order: formData.order,
        updatedAt: Timestamp.now(),
        updatedBy: $authStore.userData.name,
      };

      if (isEditMode && selectedCard) {
        await updateDoc(doc(db, "landingPageCards", selectedCard.id), cardData);
        alert(t.messages.cardUpdated);
      } else {
        const newDocRef = doc(collection(db, "landingPageCards"));
        await setDoc(newDocRef, {
          ...cardData,
          createdAt: Timestamp.now(),
          createdBy: $authStore.userData.name,
        });
        alert(t.messages.cardCreated);
      }

      closeModal();
      loadCards();
    } catch (error) {
      console.error("Error saving card:", error);
      alert(`${t.messages.saveFailed}: ${error.message}`);
    } finally {
      loading = false;
    }
  }

  async function handleDelete(card) {
    if (!confirm(`${t.messages.deleteConfirm} "${card.title}"?`)) {
      return;
    }

    loading = true;
    try {
      // Delete images from storage
      const imagesToDelete =
        card.images || (card.imageUrl ? [card.imageUrl] : []);

      for (const imageUrl of imagesToDelete) {
        try {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        } catch (error) {
          console.log("Image deletion error:", error);
        }
      }

      await deleteDoc(doc(db, "landingPageCards", card.id));
      alert(t.messages.cardDeleted);
      loadCards();
    } catch (error) {
      console.error("Error deleting card:", error);
      alert(t.messages.deleteFailed);
    } finally {
      loading = false;
    }
  }

  async function moveCard(card, direction) {
    const currentIndex = cards.findIndex((c) => c.id === card.id);
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= cards.length) return;

    loading = true;
    try {
      await Promise.all([
        updateDoc(doc(db, "landingPageCards", cards[currentIndex].id), {
          order: newIndex,
        }),
        updateDoc(doc(db, "landingPageCards", cards[newIndex].id), {
          order: currentIndex,
        }),
      ]);
    } catch (error) {
      console.error("Error moving card:", error);
      alert(t.messages.moveFailed);
    } finally {
      loading = false;
    }
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
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-white">{t.header.title}</h1>
            <p class="text-white/80 mt-1">{t.header.subtitle}</p>
          </div>
        </div>
        <button
          on:click={openAddModal}
          class="px-6 py-3 bg-linear-to-r from-[#FFD700] to-[#FFA500] text-[#1A4786] font-bold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
        >
          {t.header.addButton}
        </button>
      </div>
    </div>

    <!-- Cards Grid -->
    {#if loading}
      <div class="py-12 text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3A7AE0] mx-auto"
        ></div>
        <p class="mt-4 text-gray-500">{t.loading}</p>
      </div>
    {:else if cards.length === 0}
      <div class="py-12 text-center">
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </div>
        <p class="mt-4 text-gray-600 font-medium">{t.noCards}</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each cards as card (card.id)}
          <div
            class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
          >
            <!-- Card Image -->
            <div class="relative h-48 bg-gray-200">
              {#if card.images && card.images.length > 0}
                <img
                  src={card.images[0]}
                  alt={card.title}
                  class="w-full h-full object-cover"
                />
                {#if card.images.length > 1}
                  <div
                    class="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs font-bold"
                  >
                    +{card.images.length - 1}
                  </div>
                {/if}
              {:else if card.imageUrl}
                <img
                  src={card.imageUrl}
                  alt={card.title}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div class="flex items-center justify-center h-full">
                  <svg
                    class="w-16 h-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              {/if}

              <!-- Order Badge -->
              <div
                class="absolute top-3 left-3 bg-[#1A4786] text-white px-3 py-1 rounded-full text-sm font-bold"
              >
                #{card.order + 1}
              </div>
            </div>

            <!-- Card Content -->
            <div class="p-5">
              <h3 class="text-lg font-bold text-[#1A4786] mb-2">
                {card.title}
              </h3>
              <p class="text-gray-600 text-sm mb-4 line-clamp-2">
                {card.description}
              </p>

              {#if card.modalContent?.badge}
                <span
                  class="inline-block px-3 py-1 text-xs font-bold rounded-full bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white mb-4"
                >
                  {card.modalContent.badge}
                </span>
              {/if}

              <!-- Action Buttons -->
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <button
                    on:click={() => moveCard(card, "up")}
                    disabled={card.order === 0}
                    class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t.card.moveUp}
                  >
                    <svg
                      class="w-4 h-4 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    on:click={() => moveCard(card, "down")}
                    disabled={card.order === cards.length - 1}
                    class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t.card.moveDown}
                  >
                    <svg
                      class="w-4 h-4 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    on:click={() => openEditModal(card)}
                    class="px-4 py-2 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-semibold rounded-lg hover:shadow-md transition-all"
                  >
                    {t.card.edit}
                  </button>
                  <button
                    on:click={() => handleDelete(card)}
                    class="px-4 py-2 bg-linear-to-r from-[#EF4444] to-[#DC2626] text-white font-semibold rounded-lg hover:shadow-md transition-all"
                  >
                    {t.card.delete}
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Add/Edit Modal -->
{#if showModal}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    style="z-index: 50;"
  >
    <div
      class="bg-white rounded-3xl shadow-2xl w-full my-8"
      style="max-width: 1024px; max-height: 90vh; display: flex; flex-direction: column;"
    >
      <div
        class="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-[#1A4786] to-[#3A7AE0] rounded-t-3xl"
        style="flex-shrink: 0;"
      >
        <h3 class="text-xl font-bold text-white">
          {isEditMode ? t.modal.editTitle : t.modal.addTitle}
        </h3>
        <button
          aria-label="Edit Modal"
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

      <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
        <form
          on:submit|preventDefault={handleSubmit}
          class="px-6 py-6 space-y-6"
        >
          <!-- Image Management -->
          <div>
            <label
              for="image-management"
              class="block text-sm font-bold text-[#1A4786] mb-3"
              >{t.modal.imageSection}</label
            >

            <!-- Image Grid -->
            {#if images.length > 0}
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {#each images as image, index}
                  <div class="relative group">
                    <img
                      src={image.url}
                      alt="Preview"
                      class="w-full h-32 object-cover rounded-xl"
                    />

                    {#if index === primaryImageIndex}
                      <div
                        class="absolute top-2 left-2 bg-linear-to-r from-[#FFD700] to-[#FFA500] text-[#1A4786] px-2 py-1 rounded-full text-xs font-bold"
                      >
                        {t.modal.primary}
                      </div>
                    {:else}
                      <button
                        type="button"
                        on:click={() => setPrimaryImage(index)}
                        class="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-full text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {t.modal.setAsPrimary}
                      </button>
                    {/if}

                    <button
                      aria-label="remove-image"
                      type="button"
                      on:click={() => removeImage(index)}
                      class="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Add Image Button -->
            <label class="block">
              <input
                type="file"
                accept="image/*"
                on:change={handleImageSelect}
                class="hidden"
              />
              <div
                class="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[#3A7AE0] hover:bg-gray-50 transition-all"
              >
                <svg
                  class="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p class="mt-2 text-sm text-gray-600 font-medium">
                  {t.modal.addImage}
                </p>
              </div>
            </label>
          </div>

          <!-- Title -->
          <div>
            <label
              for="title"
              class="block text-sm font-bold text-[#1A4786] mb-2"
              >{t.modal.title} *</label
            >
            <input
              type="text"
              bind:value={formData.title}
              required
              class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
              placeholder={t.modal.titlePlaceholder}
            />
          </div>

          <!-- Description -->
          <div>
            <label
              for="description"
              class="block text-sm font-bold text-[#1A4786] mb-2"
              >{t.modal.description} *</label
            >
            <textarea
              bind:value={formData.description}
              required
              rows="3"
              class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none resize-none"
              placeholder={t.modal.descPlaceholder}
            ></textarea>
          </div>

          <!-- Modal Content -->
          <div class="border-t pt-6">
            <h4 class="font-bold text-[#1A4786] mb-4">
              {t.modal.modalContent}
            </h4>

            <!-- Badge -->
            <div class="mb-4">
              <label
                for="badge"
                class="block text-sm font-semibold text-gray-700 mb-2"
                >{t.modal.badge}</label
              >
              <input
                type="text"
                bind:value={formData.modalContent.badge}
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none"
                placeholder={t.modal.badgePlaceholder}
              />
            </div>

            <!-- Features -->
            <div>
              <label
                for="Features"
                class="block text-sm font-semibold text-gray-700 mb-2"
                >{t.modal.features}</label
              >
              {#each [0, 1, 2] as i}
                <input
                  type="text"
                  bind:value={formData.modalContent.features[i]}
                  class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3A7AE0] focus:outline-none mb-3"
                  placeholder="{t.modal.featurePlaceholder} {i + 1}"
                />
              {/each}
            </div>
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              on:click={closeModal}
              class="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
            >
              {t.modal.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              class="px-6 py-3 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isEditMode ? t.modal.update : t.modal.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

<!-- Image Cropper Modal - AFTER THE ADD/EDIT MODAL -->
{#if showCropper && pendingImage}
  <div
    class="fixed inset-0 flex items-center justify-center p-4"
    style="z-index: 10000; background-color: rgba(0, 0, 0, 0.9);"
  >
    <div
      class="bg-white rounded-3xl shadow-2xl w-full"
      style="max-width: 900px; max-height: 90vh; display: flex; flex-direction: column;"
    >
      <!-- Fixed Header -->
      <div
        class="px-6 pt-6 pb-4 border-b border-gray-200"
        style="flex-shrink: 0;"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold text-[#1A4786]">
            {$language === "en" ? "Crop Image" : "Potong Gambar"}
          </h3>
          <button
            aria-label="Cancel Crop"
            type="button"
            on:click={cancelCrop}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              class="w-6 h-6"
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
      </div>

      <!-- Scrollable Content Area -->
      <div
        class="px-6 py-6"
        style="flex: 1; overflow-y: auto; overflow-x: hidden;"
      >
        <div
          class="bg-gray-900 rounded-xl p-4 mb-4 flex items-center justify-center"
          style="min-height: 400px;"
        >
          <canvas
            id="cropperCanvas"
            class="max-w-full mx-auto"
            style="cursor: default; display: block; max-height: 500px;"
            on:mousedown={handleCanvasMouseDown}
            on:mousemove={handleCanvasMouseMove}
            on:mouseup={handleCanvasMouseUp}
            on:mouseleave={handleCanvasMouseUp}
          ></canvas>
        </div>

        <div class="bg-blue-50 rounded-xl p-4">
          <p class="text-sm text-gray-700 leading-relaxed">
            <strong>💡 Tip:</strong>
            {$language === "en"
              ? " Drag the crop area to move it. Drag the corner or edge handles to resize while maintaining the 4:5 ratio. The image will be resized to 400×500px for optimal display."
              : " Seret area potong untuk memindahkannya. Seret pegangan sudut atau tepi untuk mengubah ukuran sambil mempertahankan rasio 4:5. Gambar akan diubah ukurannya menjadi 400×500px untuk tampilan optimal."}
          </p>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div
        class="px-6 pb-6 pt-4 border-t border-gray-200 bg-white"
        style="flex-shrink: 0;"
      >
        <div class="flex justify-end space-x-3">
          <button
            type="button"
            on:click={cancelCrop}
            class="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
          >
            {$language === "en" ? "Cancel" : "Batal"}
          </button>

          <button
            type="button"
            on:click={saveCroppedImage}
            class="px-6 py-3 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-bold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
          >
            {$language === "en" ? "Crop & Save" : "Potong & Simpan"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Image Cropper Modal-->
{#if showCropper && pendingImage}
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-60 p-4"
  >
    <div class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6">
      <h3 class="text-xl font-bold text-[#1A4786] mb-4">
        {$language === "en" ? "Crop Image" : "Potong Gambar"}
      </h3>

      <div class="bg-gray-100 rounded-xl p-4 mb-4 overflow-hidden">
        <canvas
          id="cropperCanvas"
          class="max-w-full mx-auto cursor-move"
          on:mousedown={handleCanvasMouseDown}
          on:mousemove={handleCanvasMouseMove}
          on:mouseup={handleCanvasMouseUp}
          on:mouseleave={handleCanvasMouseUp}
        ></canvas>
      </div>

      <div class="bg-blue-50 rounded-xl p-4 mb-4">
        <p class="text-sm text-gray-700">
          <strong>💡 Tip:</strong>
          {$language === "en"
            ? "Drag the crop area to adjust. The image will be resized to 400x500px (4:5 ratio) for optimal display."
            : "Seret area potong untuk menyesuaikan. Gambar akan diubah ukurannya menjadi 400x500px (rasio 4:5) untuk tampilan optimal."}
        </p>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          type="button"
          on:click={cancelCrop}
          class="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all"
        >
          {t.modal.cancelCrop}
        </button>

        <button
          type="button"
          on:click={saveCroppedImage}
          class="px-6 py-3 bg-linear-to-r from-[#3A7AE0] to-[#1A4786] text-white font-bold rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
        >
          {t.modal.cropImage}
        </button>
      </div>
    </div>
  </div>
{/if}
