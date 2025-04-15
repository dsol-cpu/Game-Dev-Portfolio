import { For, createMemo, createEffect } from "solid-js";
import { ISLANDS } from "../../constants/islands";
import Icon from "../icons/Icon";
import NavigationButton from "./NavigationButton";
import { viewStore } from "../../stores/view";

export default function NavigationMenu(props) {
  const { state: viewState } = viewStore;
  const sectionTitles = props.sectionTitles;
  const sectionIcons = {
    about: <Icon name={props.sections[0]} />,
    portfolio: <Icon name={props.sections[1]} />,
    resume: <Icon name={props.sections[2]} />,
  };

  // Debug active section changes
  createEffect(() => {
    console.log(
      "NavigationMenu - Current active section:",
      props.activeSection()
    );
  });

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

  // This function explicitly dispatches the event
  const handleSectionChange = (section, islandIndex, e) => {
    // Prevent default browser behavior
    e.preventDefault();

    console.log(
      `Navigation clicked: ${section}, current active: ${props.activeSection()}`
    );

    // Use a global variable to pass section information
    window.currentPortfolioSection = section;

    try {
      // Try different event dispatching approaches
      // 1. Standard CustomEvent
      const customEvent = new CustomEvent("portfolioSectionChange", {
        detail: { section },
        bubbles: true,
        cancelable: true,
      });

      // Dispatch on multiple targets
      window.dispatchEvent(customEvent);
      document.dispatchEvent(
        new CustomEvent("portfolioSectionChange", {
          detail: { section },
          bubbles: true,
        })
      );

      // 2. Try direct DOM approach
      const portfolioContainer = document.getElementById("portfolio-container");
      if (portfolioContainer) {
        portfolioContainer.dispatchEvent(
          new CustomEvent("portfolioSectionChange", {
            detail: { section },
            bubbles: true,
          })
        );
      }

      console.log("Events dispatched for section:", section);

      // 3. Direct call approach (as backup)
      if (typeof window.setPortfolioSection === "function") {
        window.setPortfolioSection(section);
      }
    } catch (error) {
      console.error("Error dispatching event:", error);
    }

    // Call the navigation handler only if not already navigating
    if (!props.isNavigating()) {
      props.onNavigate(section, islandIndex, e);
    } else {
      console.log("Navigation in progress, ignoring click");
    }
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
                  sectionName={sectionTitles[section]}
                  icon={sectionIcons[section]}
                  isActive={isActive}
                  isNavigatingTo={isNavigatingTo}
                  isDisabled={isDisabled}
                  status={status}
                  onClick={(e) =>
                    handleSectionChange(section, ISLANDS[section], e)
                  }
                />
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  );
}
