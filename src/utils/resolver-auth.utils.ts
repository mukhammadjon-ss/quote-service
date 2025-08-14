import { MyContext } from "../types/graphql.types";
import { GraphQLAuthUtils } from "./auth.utils";

/**
 * Higher-order function to protect resolvers with authentication
 */
export function requireAuth<T extends any[], R>(
  resolver: (parent: any, args: any, context: MyContext, info: any) => R
) {
  return (parent: any, args: any, context: MyContext, info: any): R => {
    GraphQLAuthUtils.requireAuth(context);
    return resolver(parent, args, context, info);
  };
};
