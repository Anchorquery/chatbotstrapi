/**
 * This file was automatically generated by Strapi.
 * Any modifications made will be discarded.
 */
import ckeditor5 from "@_sh/strapi-plugin-ckeditor/strapi-admin";
import ckeditor from "@ckeditor/strapi-plugin-ckeditor/strapi-admin";
import colorPicker from "@strapi/plugin-color-picker/strapi-admin";
import i18N from "@strapi/plugin-i18n/strapi-admin";
import sentry from "@strapi/plugin-sentry/strapi-admin";
import usersPermissions from "@strapi/plugin-users-permissions/strapi-admin";
import vectorField from "../../src/plugins/vector-field/strapi-admin";
import { renderAdmin } from "@strapi/strapi/admin";

renderAdmin(document.getElementById("strapi"), {
  plugins: {
    ckeditor5: ckeditor5,
    ckeditor: ckeditor,
    "color-picker": colorPicker,
    i18n: i18N,
    sentry: sentry,
    "users-permissions": usersPermissions,
    "vector-field": vectorField,
  },
});
