import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { naatiProcessor } from './functions/naatiProcessor/resource.js';
import { cclStorage as storage } from './storage/resource.js';

defineBackend({
  auth,
  data,
  storage,
  naatiProcessor,
});
