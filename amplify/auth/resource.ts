import { defineAuth } from "@aws-amplify/backend";
import { postConfirmation } from "../functions/postConfirmation/resource";
import { postAuthentication } from "../functions/postAuthentication/resource";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    postConfirmation,
    postAuthentication,
  },
});
