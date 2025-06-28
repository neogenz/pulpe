import {
  provideLottieOptions,
  provideCacheableAnimationLoader,
} from 'ngx-lottie';

/**
 * Provides Lottie configuration with lazy loading.
 * Uses dynamic import to ensure lottie-web is only loaded when needed.
 */
export function provideLazyLottie() {
  return [
    provideLottieOptions({
      player: () => import('lottie-web'),
    }),
    provideCacheableAnimationLoader(),
  ];
}