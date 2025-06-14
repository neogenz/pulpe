import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto<T = any> {
  @ApiProperty({ 
    description: 'Indicates if the request was successful',
    example: true 
  })
  success: true;

  @ApiProperty({ 
    description: 'Response data' 
  })
  data?: T;

  @ApiProperty({ 
    description: 'Success message',
    required: false 
  })
  message?: string;
}

export class ErrorResponseDto {
  @ApiProperty({ 
    description: 'Indicates the request failed',
    example: false 
  })
  success: false;

  @ApiProperty({ 
    description: 'Error message',
    example: 'An error occurred' 
  })
  error: string;

  @ApiProperty({ 
    description: 'HTTP status code',
    example: 400 
  })
  statusCode: number;

  @ApiProperty({ 
    description: 'Request timestamp',
    example: '2024-01-15T10:30:00Z' 
  })
  timestamp: string;

  @ApiProperty({ 
    description: 'Request path',
    example: '/api/budgets' 
  })
  path: string;
}