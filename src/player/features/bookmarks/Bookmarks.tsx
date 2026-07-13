import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Back from "@mui/icons-material/ChevronLeftRounded";
import styled from "@mui/material/styles/styled";

import { RootState } from "../../app/store";
import { BookmarkItem } from "./BookmarkItem";

const WallPaper = styled("div")({
  position: "absolute",
  width: "100%",
  height: "100%",
  top: 0,
  left: 0,
  overflow: "hidden",
  background: "linear-gradient(#2D3143 0%, #1e2231 100%)",
  zIndex: -1,
});

export function Bookmarks() {
  const navigate = useNavigate();
  const bookmarks = useSelector((state: RootState) => state.bookmarks.bookmarks);

  const bookmarkItems = bookmarks.allIds.map((id) => bookmarks.byId[id]);

  return (
    <>
      <WallPaper />
      <Container
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          mt: 4,
          mb: "248px",
          height: "100%",
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate(-1)}>
            <Back />
          </IconButton>
          <Typography variant="h4" component="h1">
            Bookmarks
          </Typography>
        </Stack>
        {bookmarkItems.length === 0 ? (
          <Typography color="text.secondary">
            No bookmarks yet. Bookmark a tab from the browser tab bar or add one
            in the sidebar.
          </Typography>
        ) : (
          <Grid container spacing={2} columns={{ xs: 4, sm: 9, md: 12 }}>
            {bookmarkItems.map((bookmark) => (
              <Grid xs={2} sm={3} md={3} item key={bookmark.id}>
                <BookmarkItem bookmark={bookmark} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </>
  );
}
