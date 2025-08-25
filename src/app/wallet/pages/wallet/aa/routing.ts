import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AACreatePage } from "./aa-create/aa-create.page";

const routes: Routes = [
  {
    path: "create",
    component: AACreatePage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AAModuleRoutingModule {}
