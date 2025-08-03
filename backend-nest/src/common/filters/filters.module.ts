import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './global-exception.filter';
import { GlobalExceptionFilterEnhanced } from './global-exception.filter.enhanced';

/**
 * Module for global exception filters
 * Provides centralized error handling across the application
 *
 * To use the enhanced filter with domain exception support:
 * Replace GlobalExceptionFilter with GlobalExceptionFilterEnhanced
 */
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter, // Change to GlobalExceptionFilterEnhanced for enhanced error handling
    },
  ],
  exports: [GlobalExceptionFilter, GlobalExceptionFilterEnhanced],
})
export class FiltersModule {}
