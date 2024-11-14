import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Logger } from '../logger';
import { GlobalDIDSessionsService } from './global.didsessions.service';

/**
 * Route guard that makes sure that a user is signed in before allowing navigation.
 * Otherwise, reload the page
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuardService  {
  constructor(private didSessions: GlobalDIDSessionsService, private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.didSessions.getSignedInIdentity()) {
      Logger.log("AuthGuard", "No user signed in - abnormal state - reloading the root page");
      window.location.href = "/";
      return false;
    }
    return true;
  }
}