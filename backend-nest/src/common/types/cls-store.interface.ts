import { ClsStore } from 'nestjs-cls';

export interface AppClsStore extends ClsStore {
  isDemo: boolean;
}
