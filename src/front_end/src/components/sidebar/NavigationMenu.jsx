import { For, createMemo } from "solid-js";
import { ISLANDS } from "../../constants/islands";
import Icon from "../icons/Icon";
import NavigationButton from "./NavigationButton";
import { viewStore } from "../../stores/view";

export default function NavigationMenu(props) {
  const { state: viewState } = viewStore;

  const sectionIcons = {
    home: <Icon name="home" />,
    experience: <Icon name="experience" />,
    projects: <Icon name="projects" />,
    resume: <Icon name="resume" />,
  };

  // Create derived state for each navigation item
  const getNavigationStatus = (section) => {
    if (!viewState.isScrollView) {
      if (props.isNavigating() && props.navigatingSection() === section) {
        return ` (Flying ${Math.round(props.navigationProgress())}%)`;
      } else if (
        props.isArrived() &&
        props.destinationSection() === section &&
        !props.isNavigating()
      ) {
        return " (Arrived)";
      }
    }
    return "";
  };

  return (
    <nav class="flex-1 overflow-y-auto px-4">
      <ul class="space-y-2 py-4">
        <For each={props.sections}>
          {(section) => {
            const isActive = () => props.activeSection() === section;
            const isNavigatingTo = () =>
              props.isNavigating() && props.navigatingSection() === section;
            const isDisabled = () =>
              props.isNavigating() && props.navigatingSection() !== section;

            // Generate status text for the navigation button
            const status = () => getNavigationStatus(section);

            return (
              <li>
                <NavigationButton
                  sectionName={section}
                  icon={sectionIcons[section]}
                  isActive={isActive}
                  isNavigatingTo={isNavigatingTo}
                  isDisabled={isDisabled}
                  status={status}
                  onClick={(e) => {
                    if (!props.isNavigating()) {
                      props.onNavigate(section, ISLANDS[section], e);
                    }
                  }}
                />
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
