class ReleaseTracker:
    def __init__(self):
        self.releases = {}

    def add_release(self, version, display_name, description):
        self.releases[version] = {
            "id": version,
            "name": display_name,
            "description": description
        }
        print(f"Added release: {version}: {display_name} - {description}")

    def display_releases(self):
        if not self.releases:
            print("No releases available.")
            return
        print("Current Releases:")
        release_history = [release_detail for version, release_detail in self.releases.items()]
        print(release_history)

    def get_overall_releases(self):
        if not self.releases:
            print("No releases available.")
            return
        release_history = [release_detail for version, release_detail in self.releases.items()]
        return release_history


tracker = ReleaseTracker()

# Add releases
tracker.add_release("4.5.0-0.2.1", "4.5.0-0.2.1", "4.5.0-0.2.1 (Include kanban and utilities)")
tracker.add_release("4.5.0-0.2.1-1", "4.5.0-0.2.1-1", "4.5.0-0.2.1-1 (Include kanban improvements)")
tracker.add_release("4.5.0-0.2.2", "4.5.0-0.2.2", "4.5.0-0.2.2 (Include Simulation utilities)")
