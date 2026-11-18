/**
 * Утиліта для підготовки прев'ю завантаженого користувачем фото пакування препарату (Data URL)
 */
const MAX_PACKAGING_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function prepareMedicationPhotoPreview(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Оберіть файл зображення (JPG, PNG або WebP)');
  }

  if (file.size > MAX_PACKAGING_IMAGE_SIZE_BYTES) {
    throw new Error('Розмір фото пакування не повинен перевищувати 4 МБ');
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Не вдалося зчитати файл зображення'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Помилка під час читання файлу зображення'));
    };
    reader.readAsDataURL(file);
  });
}
