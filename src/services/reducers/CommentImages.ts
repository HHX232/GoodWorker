import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Тип состояния
interface ImagesState {
   images: string[];
   isError: boolean;
}

// Начальное состояние
const initialState: ImagesState = {
   images: [],
   isError: false,
};

const imagesSlice = createSlice({
   name: 'images',
   initialState,
   reducers: {
      // Добавление новых изображений
      addCommImages: (state, action: PayloadAction<string>) => {
         state.images = [...state.images, action.payload];
      },
      // Удаление изображения по индексу
      removeCommImage: (state, action: PayloadAction<number>) => {
         state.images = state.images.filter((_, index) => index !== action.payload);
      },
      // Очистка всех изображений
      clearCommImages: (state) => {
         state.images = [];
      },
      // Установка ошибки
      setComImagesError: (state, action: PayloadAction<boolean>) => {
         state.isError = action.payload;
      },
   },
});

// Экспортируем экшены
export const { addCommImages, removeCommImage, clearCommImages, setComImagesError } = imagesSlice.actions;

// Экспортируем редюсер
export default imagesSlice.reducer;
